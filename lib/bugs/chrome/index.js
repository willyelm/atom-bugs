/**
 * Chrome Bugs
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const WebSocket = require('ws')
const EventEmitter = require('events')
const http = require('http')
const path = require('path')
const domains = require('./domains')
const spawn = require('child_process').spawn

const Page = domains.Page
const Debugger = domains.Debugger
const Console = domains.Console

class BugsChrome extends EventEmitter {
  constructor () {
    super()
    this.debugMessage = 'Paused from Atom Bugs'
    this.homePage = null
    this.sourcesPath = null
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
              let file = this.getScriptFromUrl(`${log.url}${cursor}`)
              this.emit('didGetMessage', `<span class="pull-right">${file}</span> ${log.text}`)
              break
            case Debugger.ScriptParsed:
              this.scripts.push(response.params)
              break
            case Debugger.BreakpointResolved:
              let source = this.getScriptFromUrl(response.params.breakpointId)
              this.emit('didBreak', source)
              break
            case Debugger.Paused:
              this.send(Page.SetOverlayMessage, {
                message: this.debugMessage
              })
              // console.log('paused', response.params.callFrames)
              break
            case Debugger.Resumed:
              this.send(Page.SetOverlayMessage)
              break
            default:
              console.log('unhandled response', response)
          }
        }
      })
      this.client.on('close', () => {
        this.emit('didClose')
      })
    })
  }
  destroy () {
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
  run ({url, cwd, sources, target}) {
    return new Promise((resolve, reject) => {
      // /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
      let binary = target || '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome'
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
        this.sourcesPath = path.normalize(cwd + (sources ? '/' + sources : ''))
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
  getScriptUrl (target) {
    return target.replace(this.sourcesPath, this.homePage)
  }
  getScriptFromUrl (target) {
    return target.replace(this.homePage, this.sourcesPath)
  }
  // Debugger Methods
  resume () {
    //
  }
  step () {}
  backtrace () {
    return new Promise(() => {
      this.send(Debugger.GetBacktrace, {
        // paused
      })
    })
  }
  evaluate () {}
  setBreakpoint ({target, line}) {
    return new Promise((resolve, reject) => {
      let scriptUrl = this.getScriptUrl(target)
      if (scriptUrl) {
        this
          .send('Debugger.setBreakpointByUrl', {
            lineNumber: (line - 1),
            url: scriptUrl
          })
          .catch(reject)
          .then((r) => {
            resolve({
              breakpoint: r.breakpointId
            })
          })
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
