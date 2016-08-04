'use strict'

const Debugger = require('_debugger')
const spawn = require('child_process').spawn

function Bugs (settings) {
  this.settings = {}
  Object.assign(this.settings, {
    fileName: '',
    hostname: 'localhost',
    port: 5800
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

Bugs.prototype = Object.create({}, {
  // Run and connect
  start: {
    value (consoleView) {
      return this
        .run(consoleView)
        .then(() => {
          return new Promise((resolve, reject) => {
            this.resolver = resolve
            this.rejecter = reject
            this.retry()
          })
        })
    }
  },
  // Run script
  run: {
    value (consoleView) {
      return new Promise((resolve, reject) => {
        let args = [
          `--debug-brk=${this.settings.port}`,
          this.settings.fileName
        ]
        this.childTask = spawn('node', args)
        this.childTask.stdout.on('data', consoleView.log.bind(consoleView))
        this.childTask.stderr.on('data', consoleView.error.bind(consoleView))
        // this.childTask.stdout.on('end', consoleView.info.bind(consoleView))
        // this.childTask.stderr.on('end', consoleView.error.bind(consoleView))
        this.childTask.on('exit', () => {
          this.client.destroy()
        })
        resolve(this.childTask.stdout, this.childTask.stderr)
      })
    }
  },
  // Retry connection
  retry: {
    value () {
      this.connectionAttempts++
      if (this.connectionAttempts >= 10) {
        this.rejecter('failed to connect debugger')
      } else {
        this.client.connect(this.settings.port, this.settings.hostname)
      }
    }
  },
  // Task: step
  step: {
    value (type, count) {
      return new Promise((resolve, reject) => {
        this.client.step(type, count, (err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  },
  // Task: continue
  cont: {
    value () {
      return new Promise((resolve, reject) => {
        this.client.reqContinue((err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  },
  // Task: backtrace
  backtrace: {
    value () {
      return new Promise((resolve, reject) => {
        this.client.fullTrace((err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  },
  // Task: evaluate
  evaluate: {
    value (expression) {
      return new Promise((resolve, reject) => {
        this.client.reqEval(expression, (err, res) => {
          if (err) return reject(err)
          // resolve(res)
          this.client.mirrorObject(res, 3, (e, data) => {
            resolve(data)
          })
        })
      })
    }
  },
  exec: {
    value (code) {
      return new Promise((resolve, reject) => {
        // Repl asked for scope variables
        if (code === '.scope') {
          this.client.reqScopes(resolve)
          return
        }
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
  },
  // Task: evaluate
  setBreakpoint: {
    value ({target, line, condition}) {
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
  },
  clearBreakpoint: {
    value (breakpoint) {
      return new Promise((resolve, reject) => {
        this.client.clearBreakpoint({
          breakpoint: breakpoint
        }, (err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  },
  setExceptionBreak: {
    value () {
      return new Promise((resolve, reject) => {
        this.client.reqSetExceptionBreak('all', (err, res) => {
          if (err) return reject(err)
          resolve(res)
        })
      })
    }
  }
})

module.exports = Bugs
