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
    // stack
    let stack = document.createElement('atom-bugs-stack')
    let backtrace = document.createElement('atom-bugs-section')
    let backtraceButton = document.createElement('button')
    panel.appendChild(stack)
    this.callstackList = document.createElement('atom-bugs-callstack')
    backtraceButton.className = 'btn'
    backtraceButton.innerHTML = 'CallStack'
    backtrace.appendChild(backtraceButton)
    backtrace.appendChild(this.callstackList)
    stack.appendChild(backtrace)
    // output
    let output = document.createElement('atom-bugs-output')
    this.open = false
    this.lines = document.createElement('atom-bugs-lines')
    this.lines.setAttribute('tabindex', -1)
    output.appendChild(this.lines)
    panel.appendChild(output)
    // breakpoints
    let breaks = document.createElement('atom-bugs-break')
    let points = document.createElement('atom-bugs-section')
    let pointsButton = document.createElement('button')
    panel.appendChild(breaks)
    this.breakpointList = document.createElement('atom-bugs-breakpoint')
    pointsButton.className = 'btn'
    pointsButton.innerHTML = 'Breakpoints'
    points.appendChild(pointsButton)
    points.appendChild(this.breakpointList)
    breaks.appendChild(points)
    // initial height
    let initialEvent
    let resize = (targetEvent) => {
      let offset = targetEvent.screenY - initialEvent.screenY
      let height = `${parseInt(panel.style.height || 150, 0) + offset}`
      if (height > 150 && height < 600) {
        panel.style.height = stack.style.height = breaks.style.height = output.style.height = `${height}px`
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
    this.panelView = atom.workspace.addHeaderPanel({
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
    this.panelView.destroy()
  }

  clear () {
    this.lines.innerHTML = ''
    this.callstackList.innerHTML = ''
    // this.breakpointList.innerHTML = ''
  }

  toggle () {
    if (this.open) {
      this.hide()
    } else {
      this.show()
    }
  }

  addContentWithLinks (element, {withText, shorten} = {}) {
    return new Promise((resolve, reject) => {
      element.innerHTML = String(withText).replace(/[^(?:<> \n)]+\/[a-zA-Z0-9_ \-\/\-\.\*\+]+(:[0-9:]+)?/g, (url) => {
        if (file.isRelative(url)) return url
        let paths = atom.project.getPaths()
        let text = url
        _.forEach(paths, (dir) => {
          // let base = path.dirname(dir)
          text = text.replace(dir, '')
          // <span style="display: none;">${dir}</span>
        })
        if (shorten) {
          text = file.shortener(text)
        }
        return `<a href="${url}">${text}</a>`
      })
      // get all links
      let links = Array.from(element.querySelectorAll('a'))
      if (links.length > 0) {
        _.forEach(links, (link) => {
          // add open file handler
          link.addEventListener('click', function (e) {
            file.openFromUrl(this.getAttribute('href'), { zeroBased: true })
          })
        })
      }
      resolve(element)
    })
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
      if (firstLink && _.trim(firstLink.getAttribute('href')).length > 0) {
        file.openFromUrl(firstLink.getAttribute('href'), { zeroBased: true })
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
    return new Promise((resolve, reject) => {
      if (!text) return resolve(undefined)
      setTimeout(() => {
        let line = document.createElement('div')
        if (options.className) {
          line.className = options.className
        }
        if (options.label) {
          text = options.label.outerHTML + text
        }
        line.classList.add('bugs-line')
        // replace links
        this.addContentWithLinks(line, { withText: text }).then(() => {
          // go to bottom
          this.addElement(line)
          this.scrollBottom()
        })
        this.show()
        resolve(line)
      }, 0)
    })
  }

  log (text = '') {
    return this.createLine(text)
  }

  error (text = '') {
    return this.createLine(text, {
      className: 'text-error'
    })
  }

  info (text = '') {
    return this.createLine(text, {
      className: 'text-muted'
    })
  }

  breakpoint (source = {}) {
    return this.createLine(source, {
      label: this.createLabel('Break In', {
        className: 'bugs-label-info'
      })
    })
  }

  exception (source = {}) {
    return this.createLine(source, {
      label: this.createLabel('Exception In', {
        className: 'bugs-label-error'
      })
    })
  }

  breakpoints (breakpoints) {
    this.breakpointList.innerHTML = ''
    _.forEach(breakpoints, (breakpoint) => {
      let line = document.createElement('div')
      let remove = document.createElement('i')
      remove.className = 'bugs-icon-ban pull-right'
      remove.style.cursor = 'pointer'
      remove.addEventListener('click', (e) => {
        e.stopPropagation()
        this.emit('didRemoveBreak', breakpoint)
      })
      let text = `<i class="bugs-icon-circle"></i> ${breakpoint.target}:${breakpoint.line}`
      line.className = 'bugs-line'
      this.addContentWithLinks(line, { withText: text, shorten: true }).then(() => {
        line.appendChild(remove)
        this.breakpointList.appendChild(line)
      })
    })
  }

  callstack (frames = []) {
    this.callstackList.innerHTML = ''
    _.forEach(frames, (frame) => {
      let line = document.createElement('div')
      let name = `<div class="text-right"><strong>${frame.funcName}</strong></div>`
      if (!frame.funcName) {
        name = '<div class="text-right text-muted"><i>(anonymous)</i></div>'
      }
      let text = `<span class="pull-left text-muted">${frame.location}</span>${name}`
      line.className = 'bugs-line'
      this.addContentWithLinks(line, { withText: text, shorten: true }).then(() => {
        // this.enableOpenFromLine(line)
        this.callstackList.appendChild(line)
      })
    })
  }
}

module.exports = BugsConsoleView
