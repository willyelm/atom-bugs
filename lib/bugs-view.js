/* global atom */
/**
 * Bugs View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
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
    visible: true
  })
  this.schemeView = new BugsSchemeView()
  this.consoleView = new BugsConsoleView()
  this.subscriptions = new CompositeDisposable()
  // projects
  this.projects = document.createElement('div')
  this.projects.className = 'btn-group'
  panel.appendChild(this.projects)
  // group button
  let controls = document.createElement('div')
  controls.className = 'btn-group btn-toggle btn-group-options'
  // actions group
  let actions = document.createElement('div')
  actions.className = 'btn-group btn-toggle btn-group-options'
  // extended actions group
  let extendedActions = document.createElement('div')
  extendedActions.className = 'btn-group btn-toggle btn-group-options pull-right'
  // attach panels
  panel.appendChild(controls)
  panel.appendChild(actions)
  panel.appendChild(extendedActions)
  // projects button
  this.projectButton = document.createElement('div')
  this.projectSelect = document.createElement('select')
  this.projectButton.className = 'btn btn-select'
  this.projectButton.innerHTML = '<i class="bugs-icon-archive"></i>'
  this.projectButton.appendChild(this.projectSelect)
  // scheme button
  this.schemeButton = this.addButton(controls, {
    icon: 'bugs-icon-file-code-o',
    text: 'Current File',
    tooltip: 'Scheme',
    classes: 'bugs-breadcrumb',
    action () {
      this.schemeView.show()
    }
  })
  this.schemeView.on('didSelectScheme', this.changeScheme.bind(this))
  function toggleButtons (enable) {
    if (enable) {
      controls.appendChild(this.runButton)
      controls.removeChild(stopButton)
    } else {
      controls.removeChild(this.runButton)
      controls.appendChild(stopButton)
    }
    this.schemeButton.disabled = !enable
    contButton.disabled = enable
    stepInButton.disabled = enable
    stepOutButton.disabled = enable
    clearButton.disabled = enable
    traceButton.disabled = enable
  }
  // run button
  this.runButton = this.addButton(controls, {
    icon: 'bugs-icon-play',
    action () {
      this.destroyTask()
      toggleButtons.bind(this)(false)
      this.consoleView.clear()
      let scheme = this.schemeView.getSelectedScheme()
      let runner
      // console.log('run with scheme', scheme)
      switch (scheme.title) {
        case 'Chrome':
          this.task = new Bugs.Chrome()
          runner = this.task.runChromeAndConnect({
            url: scheme.fields.url.value
          })
          break
        case 'Remote':
          this.task = new Bugs.Node({
            hostname: scheme.fields.hostname.value,
            port: scheme.fields.port.value
          })
          runner = this.task.connect()
          break
        case 'Workspace':
          this.task = new Bugs.Node({
            port: scheme.fields.port.value
          })
          let scriptPath = scheme.fields.script.value
          runner = this.task.runScript({
            console: this.consoleView,
            fileName: scriptPath,
            binary: scheme.fields.binary.value,
            env: scheme.fields.env.value
          })
          break
        default:
          let editor = atom.workspace.getActiveTextEditor()
          let filePath = editor.getPath()
          this.task = new Bugs.Node({
            port: scheme.fields.port.value
          })
          runner = this.task.runScript({
            fileName: filePath,
            console: this.consoleView,
            binary: scheme.fields.binary.value,
            env: scheme.fields.env.value
          })
      }

      this.consoleView.useTask(this.task)
      this.task.client.on('break', this.handleBreak.bind(this))
      this.task.client.on('exception', this.handleBreak.bind(this))

      runner
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
          toggleButtons.bind(this)(true)
          atom.notifications.addError('Atom Bugs', {
            detail: message,
            icon: 'bug'
          })
        })
    }
  })
  // stop button
  let stopButton = this.addButton(controls, {
    icon: 'bugs-icon-stop',
    action () {
      this.consoleView.clear()
      this.destroyTask()
      toggleButtons.bind(this)(true)
    }
  })
  // continue button
  let contButton = this.addButton(actions, {
    icon: 'bugs-icon-step-forward',
    tooltip: 'Continue',
    action () {
      this.task.cont()
    }
  })
  // step in button
  let stepInButton = this.addButton(actions, {
    icon: 'bugs-icon-long-arrow-up',
    tooltip: 'Step In',
    action () {
      this.task.step('in', 1)
    }
  })
  // step out button
  let stepOutButton = this.addButton(actions, {
    icon: 'bugs-icon-long-arrow-down',
    tooltip: 'Step Out',
    action () {
      this.task.step('out', 1)
    }
  })
  // clear console button
  let clearButton = this.addButton(extendedActions, {
    icon: 'bugs-icon-terminal',
    tooltip: 'Clear Console',
    action () {
      this.consoleView.clear()
    }
  })
  let traceButton = this.addButton(extendedActions, {
    icon: 'bugs-icon-tasks',
    tooltip: 'Print Backtrace',
    action () {
      this
        .task
        .backtrace()
        .then((b) => {
          this.consoleView.backtrace(b)
        })
    }
  })
  // disable task required buttons
  controls.removeChild(stopButton)
  contButton.disabled = true
  stepInButton.disabled = true
  stepOutButton.disabled = true
  clearButton.disabled = true
  traceButton.disabled = true
  // breakpoints
  this.breakpoints = []
  return (this)
}

BugsView.prototype = Object.create({}, {

  observe: {
    value () {
      let currentEditor
      let self = this
      function breakpointHandler (e) {
        let sourceFile = currentEditor.getPath()
        let element = e.target
        let isBreakpoint = element.classList.contains('atom-bugs-breakpoint')
        if (isBreakpoint) {
          element = e.target.parentNode
        }
        // console.log('clicked', element.classList)
        if (element.classList.contains('line-number')) {
          let lineNumber = Number(element.textContent)
          let currentIndex = self.indexBreak(sourceFile, lineNumber)
          if (currentIndex >= 0) {
            self.removeBreakWithIndex(currentEditor, currentIndex)
          } else {
            self.addBreak(currentEditor, sourceFile, lineNumber)
          }
        }
      }
      // toggle debug bar
      atom.workspace.observeActivePaneItem((editor = {}) => {
        if (!editor.getPath) return
        let sourceFile = editor.getPath()
        // determine if run should be enabled
        let scheme = this.schemeView.getSelectedScheme()
        this.determineRunInability(scheme)
        // attach breakpoints to javascript files only
        if (this.isEnabledEditor(editor)) {
          // restore breakpoints
          this
            .breakpoints
            .filter((b) => {
              return (b.target === sourceFile)
            })
            .forEach((b) => {
              if (b.marker) {
                b.marker.destroy()
              }
              b.marker = this.addMarker(editor, b.line)
            })
          // attach breakpoint handlers
          currentEditor = editor
          let editorElement = editor.editorElement.shadowRoot
          editorElement.removeEventListener('click', breakpointHandler)
          editorElement.addEventListener('click', breakpointHandler)
        }
      })
      // atom.workspace.observeTextEditors((editor) => {})
      function buildProjectPaths (projectPaths) {
        projectPaths.forEach((url) => {
          let option = document.createElement('option')
          let projectPath = path.parse(url)
          option.value = url
          option.innerHTML = projectPath.name
          self.projectSelect.appendChild(option)
        })
        self.projectSelect.addEventListener('change', (e) => {
          self.schemeView.useSettingFromProject(self.projectSelect.value)
        })
        // use current project
        if (projectPaths.length > 0) {
          self.projects.appendChild(self.projectButton)
          self.schemeView.useSettingFromProject(projectPaths[0])
        } else if (self.projectButton.parentNode) {
          self.projects.removeChild(self.projectButton)
          self.schemeView.useSettingFromProject('global')
        }
      }
      // fill projects
      let projectPaths = atom.project.getPaths()
      buildProjectPaths(projectPaths)
      // check for projects paths
      atom.project.onDidChangePaths(buildProjectPaths)
    }
  },

  isEnabledEditor: {
    value (editor) {
      if (!editor) return false
      let grammar = editor.getGrammar()
      let enabledGrammars = ['JavaScript', 'CoffeeScript', 'TypeScript']
      return enabledGrammars.indexOf(grammar.name) >= 0
    }
  },

  determineRunInability: {
    value (scheme) {
      if (scheme && scheme.title === 'Current File') {
        let editor = atom.workspace.getActiveTextEditor()
        this.runButton.disabled = !this.isEnabledEditor(editor)
      } else {
        this.runButton.disabled = false
      }
    }
  },

  changeScheme: {
    value (scheme) {
      this.determineRunInability(scheme)
      this.schemeButton
        .querySelector('.bugs-button-text')
        .innerHTML = ` ${scheme.title}`
      this.schemeButton
        .querySelector('.bugs-button-icon')
        .className = `bugs-button-icon ${scheme.icon}`
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

  addMarker: {
    value (editor, lineNumber) {
      let range = [[lineNumber - 1, 0], [lineNumber - 1, 0]]
      let marker = editor.markBufferRange(range)
      return editor.decorateMarker(marker, {
        type: 'line-number',
        class: 'bugs-line-breakpoint'
      })
    }
  },

  addBreak: {
    value (editor, filePath, lineNumber) {
      let breakpoint = {
        target: filePath,
        line: lineNumber,
        marker: this.addMarker(editor, lineNumber)
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
        setTimeout(() => {
          if (this.task && breakpoint.number) {
            this.task.clearBreakpoint(breakpoint.number)
          }
          breakpoint.marker.destroy()
          this.breakpoints.splice(index, 1)
        }, 0)
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
      buttonIcon.classList.add('bugs-button-icon')
      button.appendChild(buttonIcon)
      if (options.text) {
        let text = document.createElement('span')
        text.className = 'bugs-button-text'
        text.innerHTML = ` ${options.text} `
        button.appendChild(text)
      }
      button.addEventListener('click', () => {
        // options.action.bind(this)
        options.action.call(this)
      })
      if (options.tooltip) {
        let tooltip = atom.tooltips.add(buttonIcon, {
          title: options.tooltip,
          placement: 'bottom',
          trigger: 'hover'
        })
        this.subscriptions.add(tooltip)
      }
      element.appendChild(button)
      return button
    }
  },

  handleBreak: {
    value (r) {
      this.task.client.currentSourceLine = r.body.sourceLine
      this.task.client.currentSourceLineText = r.body.sourceLineText
      this.task.client.currentSourceColumn = r.body.sourceColumn
      this.task.client.currentFrame = 0
      this.task.client.currentScript = r.body.script && r.body.script.name
      this.consoleView.breakpoint(r.body)
    }
  }
})

module.exports = BugsView
