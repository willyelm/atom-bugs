/* global atom */
/**
 * Bugs Console View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const EventEmitter = require('events')

class BugsConsoleView extends EventEmitter {

  constructor () {
    super()
    let panel = document.createElement('atom-bugs-console')
    panel.className = 'native-key-bindings'
    // debugger
    let debug = document.createElement('atom-bugs-debug')
    panel.appendChild(debug)
    // output
    // let output = document.createElement('atom-bugs-output')
    this.lines = document.createElement('atom-bugs-output')
    this.lines.setAttribute('tabindex', -1)
    // evaluator
    // let input = document.createElement('input')
    // input.className = 'form-control'
    // input.placeholder = 'Evaluate a expression.'
    // panel.appendChild(input)
    // output.appendChild(this.lines)
    // output.appendChild(input)
    panel.appendChild(this.lines)
    // input.addEventListener('keydown', (e) => {
    //   if (e.keyCode === 13) {
    //     let expression = input.value
    //     this.emit('didEnterText', expression, input)
    //     input.value = ''
    //   }
    // })
    this.panelView = atom.workspace.addTopPanel({
      item: panel,
      visible: false
    })
  }

  show () {
    // show only if it has contents
    this.panelView.show()
  }

  hide () {
    this.panelView.hide()
  }

  destroy () {
    // destroy
  }

  clear () {
    setTimeout(() => {
      while (this.lines.hasChildNodes()) {
        this.lines.removeChild(this.lines.lastChild)
      }
    }, 0)
  }

  createLabel (message, options = {}) {
    let label = document.createElement('span')
    if (options.className) {
      label.className = options.className
    }
    label.innerHTML = message
    label.classList.add('bugs-label')
    return label
  }

  createLine (text, options = {}) {
    if (!text) return
    let line = document.createElement('div')
    if (options.className) {
      line.className = options.className
    }
    if (options.label) {
      text = options.label.outerHTML + text
    }
    line.classList.add('bugs-line')
    // replace links
    line.innerHTML = String(text)
      .replace(/[^(?:<>)]+\/[a-zA-Z0-9_ \-\/\-\.\*\+]+(:[0-9:]+)?/g, (url) => {
        atom.project.getPaths().forEach((dir) => {
          // let base = path.dirname(dir)
          url = url.replace(dir, `<span style="display: none;">${dir}</span>`)
        })
        return `<a href="#">${url}</a>`
      })
    // get all links
    let links = Array.from(line.querySelectorAll('a'))
    if (links.length > 0) {
      links.forEach((link) => {
        // add open file handler
        link.addEventListener('click', function (e) {
          let source = this.textContent.split(':')
          let position = {
            initialLine: Number(source[1]) - 1
          }
          if (source[2]) {
            position.initialColumn = Number(source[2]) - 1
          }
          atom.workspace.open(source[0], position)
        })
      })
    }
    // go to bottom
    this.lines.appendChild(line)
    this.lines.scrollTop = this.lines.scrollHeight - this.lines.clientHeight
    this.show()
  }

  log (text = '') {
    this.createLine(text)
  }

  error (text = '') {
    this.createLine(text, {
      className: 'text-error'
    })
  }

  info (text = '') {
    this.createLine(text, {
      className: 'text-muted'
    })
  }

  describe (variable) {
    let type = (typeof variable)
    let className
    let labelText
    // String, Function, Number, Boolean, (Object, Array, Date)
    switch (type) {
      case 'object':
        className = 'bugs-label-object'
        labelText = 'Object'
        variable = JSON.stringify(variable, null, 2)
        break
      case 'boolean':
        className = 'bugs-label-boolean'
        labelText = 'Boolean'
        break
      case 'number':
        className = 'bugs-label-number'
        labelText = 'Number'
        break
      case 'function':
        className = 'bugs-label-function'
        labelText = 'Function'
        break
      default:
        className = 'bugs-label-string'
        labelText = 'String'
    }
    this.createLine(variable, {
      label: this.createLabel(labelText, {
        className: className
      })
    })
  }
  breakpoint (source = {}) {
    // if (source.exception) {
    //   text = 'Exception In'
    //   className = 'bugs-label-error'
    // }
    this.createLine(source, {
      // className: 'text-info',
      label: this.createLabel('Break In', {
        className: 'bugs-label-info'
      })
    })
  }
  backtrace (trace = {}) {
    let output = ''
    trace.frames.forEach((frame) => {
      output += `\n${frame.func.inferredName || frame.func.name || frame.func.className} at ${frame.script.name}:${frame.line}`
    })
    this.createLine(output, {
      label: this.createLabel('Backtrace', {
        className: 'bugs-label-trace'
      })
    })
  }
}

module.exports = BugsConsoleView
