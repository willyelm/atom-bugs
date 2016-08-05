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
    // output
    this.output = document.createElement('pre')
    this.output.setAttribute('tabindex', -1)
    panel.appendChild(this.output)
    // evaluator
    let input = document.createElement('input')
    input.className = 'form-control'
    input.placeholder = 'Evaluate a expression.'
    panel.appendChild(input)
    input.addEventListener('keydown', (e) => {
      if (e.keyCode === 13) {
        let expression = input.value
        this.emit('didEnterText', expression, input)
        input.value = ''
      }
    })
    this.panelView = atom.workspace.addTopPanel({
      item: panel,
      visible: false
    })
  }

  show () {
    // show only if it has contents
    if (this.output.innerHTML.length > 0) {
      this.panelView.show()
    }
  }

  hide () {
    this.panelView.hide()
  }

  destroy () {
    // destroy
  }

  clear () {
    setTimeout(() => {
      while (this.output.hasChildNodes()) {
        this.output.removeChild(this.output.lastChild)
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
    let line = document.createElement('div')
    if (options.className) {
      line.className = options.className
    }
    if (options.label) {
      text = options.label.outerHTML + text
      // text = `${options.label.outerHTML} ${text}`
    }
    line.classList.add('bugs-line')
    // replace links
    //
    line.innerHTML = String(text)
      .replace(/\/[a-zA-Z0-9_ \-\/\-\.\*\+]+:[0-9:]+/g, (url) => {
        atom.workspace.project.rootDirectories.forEach((dir) => {
          url = url.replace(dir.realPath, `<span style="display: none;">${dir.realPath}</span>`)
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
    this.output.appendChild(line)
    this.output.scrollTop = this.output.scrollHeight - this.output.clientHeight
    this.show()
  }
  log (text = '') {
    this.createLine(`${text || '&nbsp;'}`)
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
  debug (variable) {
    let type = (typeof variable)
    let className
    let labelText
    // String, Function, Number, Boolean, (Object, Array, Date)
    switch (type) {
      case 'string':
        className = 'bugs-label-string'
        labelText = 'S'
        break
      case 'boolean':
        className = 'bugs-label-boolean'
        labelText = 'B'
        break
      case 'number':
        className = 'bugs-label-number'
        labelText = 'N'
        break
      case 'function':
        className = 'bugs-label-function'
        labelText = 'F'
        break
      default:
        className = 'bugs-label-object'
        labelText = 'O'
    }
    this.createLine(variable, {
      label: this.createLabel(labelText, {
        className: className
      })
    })
  }
  breakpoint (source = {}) {
    let text = 'Break In'
    let className = 'bugs-label-info'
    if (source.exception) {
      text = 'Exception In'
      className = 'bugs-label-error'
    }
    this.createLine(`${source.script.name}:${source.sourceLine + 1}`, {
      // className: 'text-info',
      label: this.createLabel(text, {
        className: className
      })
    })
  }
  backtrace (trace = {}) {
    let output = ''
    trace.frames.forEach((frame) => {
      output += `\n<strong>${frame.func.inferredName || frame.func.name || frame.func.className}</strong> at ${frame.script.name}:${frame.line}`
    })
    this.createLine(output, {
      label: this.createLabel('Backtrace', {
        className: 'bugs-label-trace'
      })
    })
  }
}

module.exports = BugsConsoleView
