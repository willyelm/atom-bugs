/* global atom */
/**
 * Bugs Console View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const EventEmitter = require('events')
const file = require('./file')

class BugsConsoleView extends EventEmitter {

  constructor () {
    super()
    let panel = document.createElement('atom-bugs-console')
    let resizer = document.createElement('div')
    resizer.className = 'atom-bugs-resizer'
    panel.className = 'native-key-bindings'
    panel.appendChild(resizer)
    // debugger
    let debug = document.createElement('atom-bugs-debug')
    panel.appendChild(debug)
    // callstack
    let callstackSection = document.createElement('atom-bugs-section')
    let callstackButton = document.createElement('button')
    this.callstackList = document.createElement('atom-bugs-callstack')
    callstackButton.className = 'btn'
    callstackButton.innerHTML = 'CallStack'
    callstackSection.appendChild(callstackButton)
    callstackSection.appendChild(this.callstackList)
    debug.appendChild(callstackSection)
    // output
    let output = document.createElement('atom-bugs-output')
    this.open = false
    this.lines = document.createElement('atom-bugs-lines')
    this.lines.setAttribute('tabindex', -1)
    output.appendChild(this.lines)
    panel.appendChild(output)
    // initial height
    let initialEvent
    let resize = (targetEvent) => {
      let offset = targetEvent.screenY - initialEvent.screenY
      let height = `${parseInt(panel.style.height || 150, 0) + offset}`
      if (height > 150 && height < 600) {
        panel.style.height = `${height}px`
        debug.style.height = `${height}px`
        output.style.height = `${height}px`
        this.lines.style.height = `${height - 26}px`
      }
      initialEvent = targetEvent
    }
    resizer.addEventListener('mousedown', (e) => {
      initialEvent = e
      document.addEventListener('mousemove', resize)
      document.addEventListener('mouseup', () => {
        document.removeEventListener('mouseup', resize)
        document.removeEventListener('mousemove', resize)
      })
    })
    // evaluator
    let input = document.createElement('input')
    input.className = 'form-control'
    input.placeholder = 'Evaluate a expression.'
    output.appendChild(input)
    input.addEventListener('keydown', (e) => {
      if (e.keyCode === 13 && _.trim(input.value).length > 0) {
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
    this.open = true
    this.panelView.show()
  }

  hide () {
    this.open = false
    this.panelView.hide()
  }

  destroy () {
    // destroy
  }

  clear () {
    this.lines.innerHTML = ''
    this.callstackList.innerHTML = ''
  }

  toggle () {
    if (this.open) {
      this.hide()
    } else {
      this.show()
    }
  }

  addContentWithLinks (element, text) {
    element.innerHTML = text.replace(/[^(?:<> \n)]+\/[a-zA-Z0-9_ \-\/\-\.\*\+]+(:[0-9:]+)?/g, (url) => {
      if (file.isRelative(url)) return url
      let paths = atom.project.getPaths()
      _.forEach(paths, (dir) => {
        // let base = path.dirname(dir)
        url = url.replace(dir, `<span style="display: none;">${dir}</span>`)
      })
      return `<a href="#">${url}</a>`
    })
    // get all links
    let links = Array.from(element.querySelectorAll('a'))
    if (links.length > 0) {
      _.forEach(links, (link) => {
        // add open file handler
        link.addEventListener('click', function (e) {
          file.openFromUrl(this.textContent, { zeroBased: true })
        })
      })
    }
  }

  addElement (element) {
    this.lines.appendChild(element)
    this.scrollBottom()
  }

  scrollBottom () {
    this.lines.scrollTop = this.lines.scrollHeight - this.lines.clientHeight
  }

  enableOpenFromLine (element) {
    element.addEventListener('click', () => {
      let firstLink = element.querySelector('a')
      if (firstLink && _.trim(firstLink.textContent).length > 0) {
        file.openFromUrl(firstLink.textContent, { zeroBased: true })
      }
    })
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
    this.addContentWithLinks(line, String(text))
    // go to bottom
    this.addElement(line)
    this.scrollBottom()
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

  breakpoint (source = {}) {
    this.createLine(source, {
      label: this.createLabel('Break In', {
        className: 'bugs-label-info'
      })
    })
  }

  exception (source = {}) {
    this.createLine(source, {
      label: this.createLabel('Exception In', {
        className: 'bugs-label-error'
      })
    })
  }

  callstack (frames = []) {
    this.callstackList.innerHTML = ''
    _.forEach(frames, (frame) => {
      let line = document.createElement('div')
      let name = `<strong class="pull-right">${frame.funcName}</strong>`
      if (!frame.funcName) {
        name = '<i class="pull-right text-muted">(anonymous)</i>'
      }
      let text = `<span class="pull-left text-muted">${frame.location}</span> ${name}`
      line.className = 'bugs-line'
      this.addContentWithLinks(line, String(text))
      this.enableOpenFromLine(line)
      this.callstackList.appendChild(line)
    })
  }
}

module.exports = BugsConsoleView
