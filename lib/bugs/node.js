/**
 * Bugs
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const path = require('path')
const Debugger = require('_debugger')
const spawn = require('child_process').spawn
const EventEmitter = require('events')

class NodeBugs extends EventEmitter {

  constructor (settings) {
    super()
    this.settings = {}
    this.defaultPort = 5858
    Object.assign(this.settings, {
      hostname: 'localhost',
      port: this.defaultPort
    }, settings)
    // debugger
    this.client = new Debugger.Client()
    this.protocol = new Debugger.Protocol()
    this.connectionAttempts = 0
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
  // Run script
  run (settings) {
    let options = Object.create(settings)
    function normalize (dir) {
      return dir.replace(/^~/, process.env.HOME)
    }
    return new Promise((resolve, reject) => {
      let args = [
        `--debug-brk=${this.settings.port || this.defaultPort}`,
        normalize(options.fileName)
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
  // Task: step
  step (type, count) {
    return new Promise((resolve, reject) => {
      this.client.step(type, count, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  // Task: continue
  cont () {
    return new Promise((resolve, reject) => {
      this.client.reqContinue((err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
  // Task: backtrace
  backtrace () {
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
        // resolve(res)
        this.client.mirrorObject(res, 5, (e, data) => {
          resolve(data)
        })
      })
    })
  }
  exec (code) {
    return new Promise((resolve, reject) => {
      var frame = this.client.currentFrame === -1 ? frame : undefined
      // Request remote evaluation globally or in current frame
      this.client.reqFrameEval(code, frame, (e, res) => {
        if (e) return reject(e)
        // Request object by handles (and it's sub-properties)
        this.client.mirrorObject(res, 3, (e, mirror) => {
          resolve(mirror)
        })
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
