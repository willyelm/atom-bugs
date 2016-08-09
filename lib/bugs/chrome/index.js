/**
 * Chrome Bugs
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const http = require('http')
const path = require('path')
const spawn = require('child_process').spawn
const domains = require('./domains')
const file = require('../../file')

const WebSocket = require('ws')
const EventEmitter = require('events')
const Page = domains.Page
const Debugger = domains.Debugger
const Console = domains.Console

class BugsChrome extends EventEmitter {
  constructor () {
    super()
    this.debugMessage = 'Paused from Atom Bugs'
    this.homePage = null
    this.sourcesPath = null
    this.sourceMaps = false
    this.scripts = []
    this.subscriptions = []
    this.settings = {
      hostname: '127.0.0.1',
      port: 9222
    }
  }
  send (method, params) {
    return new Promise((resolve, reject) => {
      let builder = {
        id: this.requestToken,
        method: method
      }
      if (params) {
        builder.params = params
      }
      this.subscriptions[builder.id] = {
        resolve: resolve,
        reject: reject
      }
      this.client.send(JSON.stringify(builder))
      this.requestToken++
    })
  }
  connect (wsUrl) {
    return new Promise((resolve, reject) => {
      this.client = new WebSocket(wsUrl)
      this.requestToken = 1
      this.client.on('error', reject)
      this.client.on('open', () => {
        this.client.removeListener('error', reject)
        this.client.on('error', (e) => this.emit('didGetError', e))
        // open initial url
        this
          .send(Console.Enabled)
          .then(() => {
            return this.send(Debugger.Enabled)
          })
          .then(() => {
            return this.send('Debugger.setBreakpointsActive', {
              active: true
            })
          })
          .then(() => {
            resolve(this.client)
          })
      })
      this.client.on('message', (message) => {
        let response = JSON.parse(message)
        if (response.id && this.subscriptions[response.id]) {
          // subsscriptions
          let subscription = this.subscriptions[response.id]
          if (response.result) {
            subscription.resolve(response.result)
          } else {
            subscription.reject(response.error)
          }
        } else {
          // methods
          switch (response.method) {
            case Console.MessageAdded:
              let log = response.params.message
              let cursor = log.line > 0 ? `:${log.line}:${log.column}` : ''
              let fileUrl = this.getScriptPathFromUrl(`${log.url}${cursor}`)
              this.emit('didGetMessage', `<span class="pull-right">${fileUrl}</span> ${log.text}`)
              break
            case Debugger.ScriptParsed:
              // only register scripts from this page
              if (response.params.executionContextId === 1) {
                this.scripts.push(response.params)
              }
              break
            // case Debugger.BreakpointResolved:
            //   let source = this.getScriptPathFromUrl(response.params.breakpointId)
            //   this.emit('didBreak', file.convertToOneBased(source))
            //   break
            case Debugger.Paused:
              this.send(Page.SetOverlayMessage, {
                message: this.debugMessage
              })
              // parse frames
              let frames = _.map(response.params.callFrames, (frame) => {
                let script = this.getScriptFromId(_.get(frame, 'location.scriptId'))
                let fileUrl = _.get(script, 'url')
                let filePath = this.getScriptPathFromUrl(fileUrl)
                return {
                  fileUrl: fileUrl,
                  filePath: filePath,
                  lineNumber: _.get(frame, 'location.lineNumber'),
                  columnNumber: _.get(frame, 'location.columnNumber'),
                  funcName: _.get(frame, 'functionName'),
                  location: file.convertToOneBased(`${filePath}:${frame.location.lineNumber}:${frame.location.columnNumber}`)
                }
              })
              this.emit('didChangeBacktrace', frames)
              let frame = frames[0]
              if (frame.filePath) {
                this.emit('didBreak', frame.location)
              }
              break
            case Debugger.Resumed:
              this.send(Page.SetOverlayMessage)
              break
            default:
              // console.log('unhandled response', response)
          }
        }
      })
      this.client.on('close', () => {
        this.emit('didClose')
      })
    })
  }
  destroy () {
    this.scripts = []
    this.subscriptions = []
    if (this.childTask) {
      this.childTask.kill()
    }
  }
  runBrowser (options) {
    return this
      .run(options)
      .then((webSocketDebuggerUrl) => {
        return this.connect(webSocketDebuggerUrl)
      })
  }
  run ({url, cwd, sources, target, maps} = {}) {
    return new Promise((resolve, reject) => {
      // /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
      let binary = (target || '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome')
      let sArgs = [
        `--remote-debugging-address=${this.settings.hostname}`,
        `--remote-debugging-port=${this.settings.port}`,
        '--no-first-run',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--no-default-browser-check',
        '--num-raster-threads=4',
        '--user-data-dir=$(mktemp -d -t \'chrome-remote_data_dir\')'
      ]
      if (url) {
        this.homePage = url
      }
      if (cwd) {
        this.sourcesPath = path.normalize(cwd + (sources ? '/' + sources : '')) + '/'
      }
      if (maps) {
        this.sourceMaps = maps
      }
      this.childTask = spawn(binary, sArgs, {
        shell: true
      })
      this.childTask.stdout.on('data', (res) => this.emit('didGetMessage', res))
      // this.childTask.stderr.on('data', (res) => this.emit('didGetError', res))
      this.childTask.stdout.on('end', (res) => this.emit('didEndMessage', res))
      this.childTask.stderr.on('end', (res) => this.emit('didEndError', res))
      setTimeout(() => resolve(this.getTarget()), 1000)
    })
  }
  getTarget () {
    // `ws://${this.settings.hostname}:${this.settings.port}`
    return new Promise((resolve, reject) => {
      let options = {
        hostname: this.settings.hostname,
        port: this.settings.port,
        path: '/json',
        method: 'GET'
      }
      let req = http.request(options, (res) => {
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          try {
            let targets = JSON.parse(String(chunk))
            targets.forEach((target) => {
              if (target.url === 'chrome://newtab/') {
                this.emit('didGetError', `Chrome Debugger listening on [::]:${this.settings.port}`)
                resolve(target.webSocketDebuggerUrl)
              }
            })
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('error', reject)
      req.end()
    })
  }
  getScriptId (target) {
    let index = this.scripts.findIndex((item) => {
      return (item.url.replace(this.homePage, this.sourcesPath) === target)
    })
    let script = this.scripts[index]
    return script ? script.scriptId : null
  }
  getScriptFromId (scriptId) {
    let index = this.scripts.findIndex((item) => {
      return (item.scriptId === scriptId)
    })
    return this.scripts[index]
  }
  getScriptUrl (target) {
    let sources = path.normalize(this.sourcesPath)
    let scriptUrl = _.trimEnd(this.sourceMaps || this.homePage, '/') + '/'
    return target.replace(sources, scriptUrl)
  }
  getScriptPathFromUrl (target = '') {
    let d = path.normalize('/' + this.sourcesPath + '/')
    return path.normalize(target.replace(this.homePage, d))
  }
  openProjectPage () {
    this.emit('didGetMessage', `Navigating ${this.homePage}`)
    return this.send(Page.Navigate, {
      url: this.homePage
    })
  }
  parseObject (data) {
    return new Promise((resolve, reject) => {
      if (data.className === 'Date') {
        resolve({
          type: data.type,
          className: data.className,
          value: data.description
        })
      } else {
        resolve({
          type: data.type,
          className: data.className,
          get: () => {
            return new Promise((resolver, rejecter) => {
              return this
                .send('Runtime.getProperties', {
                  objectId: data.objectId,
                  ownProperties: true
                })
                .then((res) => {
                  let object = {}
                  let promises = _.map(res.result, (handle) => {
                    return this.parse(handle.value).then((value) => {
                      _.set(object, handle.name, value)
                    })
                  })
                  return Promise.all(promises).then(() => {
                    resolver({
                      type: data.type,
                      className: data.className,
                      value: object
                    })
                  })
                })
            })
          }
        })
      }
    })
  }
  parse (data) {
    return new Promise((resolve, reject) => {
      switch (data.type) {
        case 'object':
          resolve(this.parseObject(data))
          break
        case 'string':
          resolve({
            type: data.type,
            className: 'String',
            value: String(data.value)
          })
          break
        case 'function':
          resolve({
            type: data.type,
            className: 'Function',
            value: 'function () {}'
          })
          break
        case 'number':
          resolve({
            type: data.type,
            className: 'Number',
            value: Number(data.value)
          })
          break
        case 'boolean':
          resolve({
            type: data.type,
            className: 'Boolean',
            value: Boolean(data.value)
          })
          break
        default:
          resolve({
            type: data.type,
            className: 'data.className',
            value: data.value
          })
      }
    })
  }
  // Debugger Methods
  resume () {
    return this.send(Debugger.Resume)
  }
  stepOver () {
    return this.send(Debugger.StepOver)
  }
  stepInto () {
    return this.send(Debugger.StepInto)
  }
  stepOut () {
    return this.send(Debugger.StepOut)
  }
  getBacktrace () {
    return this
      .send('Debugger.getBacktrace')
      .then((res) => {
        return res.callFrames || []
      })
  }
  evaluate (expression) {
    return this
      .getBacktrace()
      .then((callFrames) => {
        let frames = _.clone(callFrames)
        let next = (resolve, reject) => {
          let frame = frames.shift()
          this
            .send('Debugger.evaluateOnCallFrame', {
              callFrameId: frame.callFrameId,
              expression: expression,
              objectGroup: 'releaseObjectGroup',
              includeCommandLineAPI: true
            })
            .then((res) => {
              if (res.result.value === undefined && _.size(frames) > 0) {
                next(resolve, reject)
              } else {
                this.parse(res.result).then((parsed) => {
                  resolve(parsed)
                })
              }
            })
        }
        return new Promise(next)
      })
  }
  setBreakpoint ({target, line}) {
    let scriptUrl = this.getScriptUrl(target)
    return this
      .send('Debugger.setBreakpointByUrl', {
        lineNumber: (line - 1),
        url: scriptUrl
      })
      .then((r) => {
        return {
          breakpoint: r.breakpointId
        }
      })
  }
  clearBreakpoint (breakpoint) {
    return this.send('Debugger.removeBreakpoint', {
      breakpointId: breakpoint
    })
  }
  enableBreakOnException () {}
}

module.exports = BugsChrome
