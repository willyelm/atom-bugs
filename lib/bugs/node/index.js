/**
 * Node Bugs
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const path = require('path')
const Debugger = require('_debugger')
const EventEmitter = require('events')
const spawn = require('child_process').spawn

class NodeBugs extends EventEmitter {

  constructor (settings) {
    super()
    this.settings = {}
    this.defaultPort = 5858
    this.scripts = []
    Object.assign(this.settings, {
      hostname: 'localhost',
      port: this.defaultPort
    }, settings)
    // debugger
    this.client = new Debugger.Client()
    // new NodeBugsClient()
    this.connectionAttempts = 0
    this.ignoreFirstBreak = true
    this.pristine = true
    this.client.once('ready', () => this.resolver(this.client))
    this.client.on('unhandledResponse', (res) => {
      console.log('unhandled res', JSON.stringify(res))
    })
    this.client.on('error', (e) => {
      setTimeout(() => {
        this.retry()
      }, 500)
    })
  }

  destroy () {
    if (this.client) {
      this.client.destroy()
    }
    if (this.childTask) {
      this.emit('didClose')
      this.childTask.kill()
    }
  }
  // connect
  connect (consoleView) {
    return new Promise((resolve, reject) => {
      this.resolver = resolve
      this.rejecter = reject
      this.retry()
    })
  }
  // Run and connect
  runScript (options) {
    return this
      .run(options)
      .then(() => {
        return this.connect()
      })
  }
  handleBreak (r) {
    this.client.currentSourceLine = r.body.sourceLine
    this.client.currentSourceLineText = r.body.sourceLineText
    this.client.currentSourceColumn = r.body.sourceColumn
    this.client.currentFrame = 0
    this.client.currentScript = r.body.script && r.body.script.name
    let source = `${r.body.script.name}:${r.body.sourceLine + 1}:${r.body.sourceColumn + 1}`

    if (this.ignoreFirstBreak && this.pristine) {
      this.pristine = false
      this.emit('didGetMessage', `Running ${source}`)
      setTimeout(() => this.resume(), 500)
    } else {
      this.emit('didBreak', source)
    }
    this
      .getBacktrace()
      .then((res) => {
        // parse frames
        let frames = _.map(res.frames, (frame) => {
          return {
            fileUrl: null,
            filePath: frame.script.name,
            lineNumber: frame.line,
            columnNumber: frame.column,
            funcName: frame.func.name,
            location: `${frame.script.name}:${frame.line + 1}:${frame.column + 1}`
          }
        })
        this.emit('didChangeBacktrace', frames)
      })
  }
  // Run script
  run (settings) {
    let options = Object.create(settings)
    function normalize (dir) {
      return dir.replace(/^~/, process.env.HOME)
    }
    return new Promise((resolve, reject) => {
      let targetScript = normalize(options.fileName)
      let args = [
        `--debug-brk=${this.settings.port || this.defaultPort}`,
        targetScript
      ]
      let script = options.binary || '/usr/local/bin/node'
      let sArgs = args.concat(options.args || [])
      let sOptions = {
        // adv settings
        detached: true,
        shell: true,
        cwd: options.cwd || normalize(path.dirname(options.fileName)),
        env: options.env || {}
      }
      if (sOptions.env.NODE_PATH) {
        sOptions.env.NODE_PATH = normalize(sOptions.env.NODE_PATH)
      }

      this.childTask = spawn(script, sArgs, sOptions)
      this.childTask.stdout.on('data', (res) => this.emit('didGetMessage', res))
      this.childTask.stderr.on('data', (res) => this.emit('didGetError', res))
      this.childTask.stdout.on('end', (res) => this.emit('didEndMessage', res))
      this.childTask.stderr.on('end', (res) => this.emit('didEndError', res))

      this.client.on('break', this.handleBreak.bind(this))
      this.client.on('exception', this.handleBreak.bind(this))

      this.childTask.on('uncaughtException', (e) => {
        this.emit('uncaughtException', e)
        this.childTask.exit(1)
      })
      this.childTask.on('exit', () => {
        this.client.destroy()
      })
      resolve(this.childTask.stdout, this.childTask.stderr)
    })
  }
  // Retry connection
  retry () {
    this.connectionAttempts++
    if (this.connectionAttempts >= 5) {
      this.rejecter('failed to connect debugger')
    } else {
      this.client.connect(this.settings.port || this.defaultPort,
        this.settings.hostname || 'localhost')
    }
  }
  step (type, count) {
    return new Promise((resolve, reject) => {
      this.client.step(type, count, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    }).then((d) => {
      console.log(d)
    })
  }

  lookup (refs) {
    return new Promise((resolve, reject) => {
      this.client.reqLookup(refs, (e, res) => {
        // if(e) return reject(e)
        resolve(res)
      })
    })
  }

  parseObject (data) {
    return new Promise((resolve, reject) => {
      if (data.value) {
        resolve({
          type: data.type,
          className: data.className,
          value: data.value
        })
      } else {
        resolve({
          type: data.type,
          className: data.className,
          get: () => {
            return new Promise((resolver, rejecter) => {
              let object = {}
              let refs = {}
              _.forEach(data.properties, (prop) => {
                refs[prop.ref] = prop.name
              })
              return this
                .lookup(_.keys(refs))
                .then((res) => {
                  let promises = _.map(res, (handle, ref) => {
                    return this.parse(handle).then((value) => {
                      _.set(object, refs[ref], value)
                    })
                  })
                  let className = data.text.match(/\#\<(.+)\>/)
                  if (className) {
                    className = className[1]
                  }
                  Promise.all(promises).then(() => {
                    resolver({
                      type: data.type,
                      className: className || data.className,
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
            className: data.className,
            name: data.name,
            value: `function ${data.name || ''} () {}`
          })
          break
        case 'number':
          resolve({
            type: data.type,
            className: 'Number',
            value: data.value
          })
          break
        case 'boolean':
          resolve({
            type: data.type,
            className: 'Boolean',
            value: data.value
          })
          break
        default:
          resolve({
            type: data.type,
            className: data.className,
            name: data.name,
            value: data.value
          })
      }
    })
  }
  static getReferences (data, path = '') {
    let references = {}
    _.forEach(data, (value, name) => {
      if (name === 'ref') {
        references[value] = path
      } else if (_.isObject(value)) {
        if (_.isNumber(name)) {
          name = `[${name}]`
        }
        let r = this.getReferences(value, path ? `${path}.${name}` : name)
        if (_.size(r)) {
          _.merge(references, r)
        }
      }
    })
    return references
  }
  // Debugger Methods
  // Task: continue
  resume () {
    return new Promise((resolve, reject) => {
      this.client.reqContinue((err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  stepOver () {
    return this.step('next', 1)
  }
  stepInto () {
    return this.step('in', 1)
  }
  stepOut () {
    return this.step('out', 1)
  }
  // Task: backtrace
  getBacktrace () {
    return new Promise((resolve, reject) => {
      this.client.fullTrace((err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  // Task: evaluate
  evaluate (expression) {
    return new Promise((resolve, reject) => {
      this.client.reqEval(expression, (err, res) => {
        if (err) return reject(err)
        resolve(this.parse(res))
      })
    })
  }
  // Task: evaluate
  setBreakpoint ({target, line, condition}) {
    return new Promise((resolve, reject) => {
      this.client.setBreakpoint({
        type: 'script',
        target: target,
        line: Number(line) - 1,
        condition: condition
      }, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  clearBreakpoint (breakpoint) {
    return new Promise((resolve, reject) => {
      this.client.clearBreakpoint({
        breakpoint: breakpoint
      }, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  enableBreakOnException () {
    return new Promise((resolve, reject) => {
      this.client.reqSetExceptionBreak('all', (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
}

module.exports = NodeBugs
