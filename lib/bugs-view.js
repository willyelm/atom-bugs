/* global atom */
'use strict'

const path = require('path')
const Bugs = require('./bugs')
const BugsSchemeView = require('./bugs-scheme-view')
const BugsConsoleView = require('./bugs-console-view')
const CompositeDisposable = require('atom').CompositeDisposable

function BugsView () {
  // panel
  let panel = document.createElement('atom-bugs-panel')
  this.panelView = atom.workspace.addTopPanel({
    item: panel,
    visible: false
  })
  this.schemeView = new BugsSchemeView()
  this.consoleView = new BugsConsoleView()
  this.subscriptions = new CompositeDisposable()
  // group button
  let controls = document.createElement('div')
  controls.className = 'btn-group btn-toggle btn-group-options'
  let actions = document.createElement('div')
  actions.className = 'btn-group btn-toggle btn-group-options'
  panel.appendChild(controls)
  panel.appendChild(actions)
  // let schemeButton =
  this.addButton(controls, {
    icon: 'bugs-icon-file-code-o',
    text: 'Current File',
    tooltip: 'Scheme',
    classes: 'bugs-breadcrumb',
    action () {
      this.schemeView.show()
    }
  })
  // run button
  let runButton = this.addButton(controls, {
    icon: 'bugs-icon-play',
    tooltip: 'Start Debug',
    action () {
      this.destroyTask()
      runButton.disabled = true
      stopButton.disabled = false
      contButton.disabled = false
      stepInButton.disabled = false
      stepOutButton.disabled = false
      this.consoleView.clear()
      let editor = atom.workspace.getActiveTextEditor()
      let filePath = editor.getPath()
      this.task = new Bugs({
        fileName: filePath
      })
      this.consoleView.useTask(this.task)
      this.task.client.on('break', (res) => {
        this.handleBreak(res.body)
      })
      this.task.client.on('exception', (res) => {
        this.handleBreak(res.body)
      })
      this
        .task
        .start(this.consoleView)
        .then(() => {
          return this.task.setExceptionBreak()
        })
        .then(() => {
          let promises = this.breakpoints.map((breakpoint) => {
            return this
              .task
              .setBreakpoint(breakpoint)
              .then((b) => {
                breakpoint.number = b.breakpoint
              })
          })
          return Promise.all(promises)
        })
        .catch((message) => {
          atom.notifications.addError('Atom Bugs', {
            detail: message,
            icon: 'bug'
          })
        })
    }
  })
  // stop button
  let stopButton = this.addButton(controls, {
    icon: 'bugs-icon-pause',
    tooltip: 'Stop Debug',
    action () {
      this.consoleView.clear()
      this.destroyTask()
      runButton.disabled = false
      stopButton.disabled = true
      stepInButton.disabled = true
      contButton.disabled = true
      stepOutButton.disabled = true
    }
  })
  stopButton.disabled = true
  // continue button
  let contButton = this.addButton(actions, {
    icon: 'bugs-icon-step-forward',
    tooltip: 'Continue',
    action () {
      this.task.cont()
    }
  })
  contButton.disabled = true
  // step in button
  let stepInButton = this.addButton(actions, {
    icon: 'bugs-icon-long-arrow-up',
    tooltip: 'Step In',
    action () {
      this.task.step('in', 1)
    }
  })
  stepInButton.disabled = true
  // step out button
  let stepOutButton = this.addButton(actions, {
    icon: 'bugs-icon-long-arrow-down',
    tooltip: 'Step Out',
    action () {
      this.task.step('out', 1)
    }
  })
  stepOutButton.disabled = true
  // breakpoints
  this.breakpoints = []
  return (this)
}

BugsView.prototype = Object.create({}, {
  observe: {
    value () {
      // toggle debug bar
      atom.workspace.observeActivePaneItem((editor = {}) => {
        if (!editor.getPath) return this.hide()
        let ext = path.extname(editor.getPath())
        // activate for javascript files only
        if (['.js'].indexOf(ext) >= 0) {
          this.show()
        } else {
          this.hide()
        }
      })
      // breakpoints manager
      atom.workspace.observeTextEditors((editor = {}) => {
        if (!editor.getPath || !editor.editorElement) return
        let sourceFile = editor.getPath()
        // rebuild current breakpoints
        this
          .breakpoints
          .filter((b) => {
            return (b.target === sourceFile)
          })
          .forEach((b) => {
            this.addBreak(editor, sourceFile, b.line)
          })
        // did open a text editor
        editor
          .editorElement
          .shadowRoot
          .addEventListener('click', (e) => {
            let element = e.target
            let isBreakpoint = element.classList.contains('atom-bugs-breakpoint')
            if (isBreakpoint) {
              element = e.target.parentNode
            }
            if (element.classList.contains('line-number')) {
              let lineNumber = Number(element.textContent)
              let currentIndex = this.indexBreak(sourceFile, lineNumber)
              if (currentIndex >= 0) {
                this.removeBreakWithIndex(editor, currentIndex)
              } else {
                this.addBreak(editor, sourceFile, lineNumber)
              }
            }
          })
      })
    }
  },
  show: {
    value () {
      this.consoleView.show()
      this.panelView.show()
    }
  },
  hide: {
    value () {
      this.consoleView.hide()
      this.panelView.hide()
    }
  },
  destroyTask: {
    value () {
      this.consoleView.hide()
      if (this.task && this.task.client) {
        this.task.client.destroy()
      }
      if (this.task && this.task.childTask) {
        this.task.childTask.kill()
      }
      this.task = null
    }
  },
  destroy: {
    value () {
      this.destroyTask()
      this.subscriptions.dispose()
    }
  },
  indexBreak: {
    value (filePath, lineNumber) {
      return this.breakpoints.findIndex((item) => {
        return (item.target === filePath && item.line === lineNumber)
      })
    }
  },
  addBreak: {
    value (editor, filePath, lineNumber) {
      let range = [[lineNumber - 1, 0], [lineNumber - 1, 0]]
      let marker = editor.markBufferRange(range)
      let breakpoint = {
        target: filePath,
        line: lineNumber,
        marker: editor.decorateMarker(marker, {
          type: 'line-number',
          class: 'bugs-line-breakpoint'
        })
      }
      this.breakpoints.push(breakpoint)
      // enable if running
      if (this.task) {
        this
          .task
          .setBreakpoint(breakpoint)
          .then((b) => {
            breakpoint.number = b.breakpoint
          })
      }
    }
  },
  removeBreakWithIndex: {
    value (editor, index) {
      if (index >= 0) {
        let breakpoint = this.breakpoints[index]
        breakpoint.marker.destroy()
        // disable if running
        if (this.task && breakpoint.number) {
          this.task.clearBreakpoint(breakpoint.number)
        }
        this.breakpoints.splice(index, 1)
      }
    }
  },

  addButton: {
    value (element, options) {
      let button = document.createElement('button')
      let buttonIcon = document.createElement('i')
      if (options.classes) {
        button.className = options.classes
      }
      button.classList.add('btn')
      buttonIcon.className = `${options.icon}`
      button.appendChild(buttonIcon)
      if (options.text) {
        let text = document.createElement('span')
        text.innerHTML = ` ${options.text} `
        button.appendChild(text)
      }
      button.addEventListener('click', () => {
        // options.action.bind(this)
        options.action.call(this)
      })
      let tooltip = atom.tooltips.add(buttonIcon, {
        title: options.tooltip,
        placement: 'bottom',
        container: 'body',
        trigger: 'hover'
      })
      this.subscriptions.add(tooltip)
      element.appendChild(button)
      return button
    }
  },

  handleBreak: {
    value (r) {
      this.task.client.currentSourceLine = r.sourceLine
      this.task.client.currentSourceLineText = r.sourceLineText
      this.task.client.currentSourceColumn = r.sourceColumn
      this.task.client.currentFrame = 0
      this.task.client.currentScript = r.script && r.script.name
      this.consoleView.breakpoint(r)
    }
  }
})

module.exports = BugsView
