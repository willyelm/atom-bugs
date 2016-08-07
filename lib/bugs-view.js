/* global atom */
/**
 * Bugs View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const path = require('path')
const file = require('./file')

const Bugs = require('./bugs')
const BugsSchemeView = require('./bugs-scheme-view')
const BugsOverlayView = require('./bugs-overlay-view')
const BugsConsoleView = require('./bugs-console-view')
const CompositeDisposable = require('atom').CompositeDisposable

class BugsView {

  constructor () {
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
    this.controls = document.createElement('div')
    this.controls.className = 'btn-group btn-toggle btn-group-options'
    // actions group
    this.actions = document.createElement('div')
    this.actions.className = 'btn-group btn-toggle btn-group-options'
    // extended actions group
    this.extendedActions = document.createElement('div')
    this.extendedActions.className = 'btn-group btn-toggle btn-group-options pull-right'
    // attach panels
    panel.appendChild(this.controls)
    panel.appendChild(this.actions)
    panel.appendChild(this.extendedActions)
    // projects button
    this.projectButton = document.createElement('div')
    this.projectSelect = document.createElement('select')
    this.projectButton.className = 'btn btn-select'
    this.projectButton.innerHTML = '<i class="bugs-icon-archive"></i>'
    this.projectButton.appendChild(this.projectSelect)
    // scheme button
    this.schemeButton = this.addButton(this.controls, {
      icon: 'bugs-icon-file-code-o',
      text: 'Current File',
      tooltip: 'Scheme',
      classes: 'bugs-breadcrumb',
      action () {
        this.schemeView.show()
      }
    })
    // this.consoleView.on('didEnterText', (expression) => {})
    this.schemeView.on('didSelectScheme', this.changeScheme.bind(this))
    // run button
    this.runButton = this.addButton(this.controls, {
      icon: 'bugs-icon-play',
      action () {
        this.startTask()
      }
    })
    // stop button
    this.stopButton = this.addButton(this.controls, {
      icon: 'bugs-icon-stop',
      action () {
        this.destroyTask()
      }
    })
    // resume button
    this.resumeButton = this.addButton(this.actions, {
      icon: 'bugs-icon-fast-forward',
      tooltip: 'Resume',
      action () {
        this.task.resume()
      }
    })
    // steo over
    this.nextButton = this.addButton(this.actions, {
      icon: 'bugs-icon-step-forward',
      tooltip: 'Step Over',
      action () {
        this.task.stepOver()
      }
    })
    // step in button
    this.stepInButton = this.addButton(this.actions, {
      icon: 'bugs-icon-long-arrow-down',
      tooltip: 'Step Into',
      action () {
        this.task.stepInto()
      }
    })
    // step out button
    this.stepOutButton = this.addButton(this.actions, {
      icon: 'bugs-icon-long-arrow-up',
      tooltip: 'Step Out',
      action () {
        this.task.stepOut()
      }
    })
    // clear console button
    this.consoleButton = this.addButton(this.extendedActions, {
      icon: 'bugs-icon-terminal',
      tooltip: 'Toggle Console',
      action () {
        this.consoleView.toggle()
      }
    })
    // disable task required buttons
    this.controls.removeChild(this.stopButton)
    this.resumeButton.disabled = true
    this.stepInButton.disabled = true
    this.stepOutButton.disabled = true
    this.nextButton.disabled = true
    // breakpoints
    this.breakpoints = []
  }

  observe () {
    let currentEditor
    let self = this
    function breakpointHandler (e) {
      let sourceFile = currentEditor.getPath()
      let element = e.target
      let isBreakpoint = element.classList.contains('atom-bugs-breakpoint')
      if (isBreakpoint) {
        element = e.target.parentNode
      }
      if (element.classList.contains('line-number')) {
        // toggle breakpoints
        let lineNumber = Number(element.textContent)
        let currentIndex = self.indexBreak(sourceFile, lineNumber)
        if (currentIndex >= 0) {
          self.removeBreakWithIndex(currentEditor, currentIndex)
        } else {
          self.addBreak(currentEditor, sourceFile, lineNumber)
        }
      }
    }
    // observer active editor
    atom.workspace.observeActivePaneItem((editor = {}) => {
      if (!editor.getPath) return
      let sourceFile = editor.getPath()
      // determine if run should be enabled
      let scheme = this.schemeView.getSelectedScheme()
      this.determineRunInability(scheme)
      // attach breakpoints to javascript files only
      if (this.isEnabledEditor(editor)) {
        let overlayView
        let evaluateHandler
        // attach expression evaluator
        editor.onDidChangeSelectionRange((event) => {
          clearTimeout(evaluateHandler)
          evaluateHandler = setTimeout(() => {
            // remove previos decorator
            if (overlayView) {
              overlayView.destroy()
            }
            // has selected range
            let range = event.selection.getScreenRange()
            if (this.task && range && range.start.row === range.end.row) {
              let text = editor.getTextInBufferRange(range)
              if (text && text.length > 0) {
                overlayView = new BugsOverlayView(editor, range)
                this
                  .task
                  .evaluate(text)
                  .then((res) => overlayView.show(res, { fromSource: text }))
                  .catch((res) => overlayView.show(res, { fromSource: text }))
              }
            }
          }, 250)
        })
        // restore breakpoints
        _
          .chain(this.breakpoints)
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
      // empty previous items
      self.projectSelect.innerHTML = ''
      _.forEach(projectPaths, (url) => {
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
        self.schemeView.useSettingFromProject('schemes')
      }
    }
    // fill projects
    let projectPaths = atom.project.getPaths()
    buildProjectPaths(projectPaths)
    // check for projects paths
    atom.project.onDidChangePaths(buildProjectPaths)
  }

  isEnabledEditor (editor = {}) {
    if (!editor || !editor.getGrammar) return false
    let grammar = editor.getGrammar()
    let enabledGrammars = ['JavaScript', 'CoffeeScript', 'TypeScript']
    return enabledGrammars.indexOf(grammar.name) >= 0
  }

  determineRunInability (scheme) {
    if (scheme && scheme.title === 'Current File') {
      let editor = atom.workspace.getActiveTextEditor()
      this.runButton.disabled = !this.isEnabledEditor(editor)
    } else {
      this.runButton.disabled = false
    }
  }

  changeScheme (scheme) {
    if (scheme) {
      this.determineRunInability(scheme)
      this.schemeButton
        .querySelector('.bugs-button-text')
        .innerHTML = ` ${scheme.title}`
      this.schemeButton
        .querySelector('.bugs-button-icon')
        .className = `bugs-button-icon ${scheme.icon}`
    }
  }

  show () {
    this.consoleView.show()
    this.panelView.show()
  }

  hide () {
    this.consoleView.hide()
    this.panelView.hide()
  }

  toggleButtons (enable) {
    if (enable && this.stopButton.parentNode) {
      this.controls.appendChild(this.runButton)
      this.controls.removeChild(this.stopButton)
    } else if (this.runButton.parentNode) {
      this.controls.removeChild(this.runButton)
      this.controls.appendChild(this.stopButton)
    }
    this.schemeButton.disabled = !enable
    this.resumeButton.disabled = enable
    this.stepInButton.disabled = enable
    this.stepOutButton.disabled = enable
    this.nextButton.disabled = enable
  }

  startTask () {
    this.destroyTask()
    this.consoleView.clear()
    let scheme = this.schemeView.getSelectedScheme()
    let promise
    // console.log('run with scheme', scheme)
    switch (scheme.title) {
      case 'Google Chrome':
        this.task = new Bugs.Chrome()
        let maps = scheme.fields.sourceMaps.value
        promise = this.task
          .runBrowser({
            target: scheme.fields.target.value,
            sources: scheme.fields.path.value,
            maps: scheme.fields.sourceMaps.active ? maps : false,
            url: scheme.fields.url.value,
            cwd: this.projectSelect.value
          })
          .then(() => {
            return this.bindBreakpoints()
          })
          .then(() => {
            return this.task.openProjectPage()
          })
        break
      case 'Remote':
        this.task = new Bugs.Node({
          hostname: scheme.fields.hostname.value,
          port: scheme.fields.port.value
        })
        promise = this
          .task
          .connect()
          .then(() => {
            return this.bindBreakpoints()
          })
        break
      case 'Workspace':
      default:
        let scriptPath
        this.task = new Bugs.Node({
          port: scheme.fields.port.value
        })
        if (scheme.title === 'Current File') {
          let editor = atom.workspace.getActiveTextEditor()
          scriptPath = editor.getPath()
        } else {
          scriptPath = scheme.fields.script.value
        }
        promise = this
          .task
          .runScript({
            fileName: scriptPath,
            binary: scheme.fields.binary.value,
            env: scheme.fields.env.value,
            args: scheme.fields.arguments.value,
            cwd: this.projectSelect.value
          })
          .then(() => {
            return this.bindBreakpoints()
          })
    }
    promise
      .then(() => {
        this.toggleButtons.bind(this)(false)
      })
      .catch(this.consoleView.error.bind(this.consoleView))
    this.task.on('didGetMessage', this.consoleView.log.bind(this.consoleView))
    this.task.on('didEndMessage', this.consoleView.log.bind(this.consoleView))
    this.task.on('didGetError', this.consoleView.error.bind(this.consoleView))
    this.task.on('didEndError', this.consoleView.error.bind(this.consoleView))
    this.task.on('didChangeBacktrace', (frames) => {
      this.consoleView.callstack(frames)
    })
    this.task.on('didBreak', (scriptUrl) => {
      this.consoleView.breakpoint(scriptUrl)
      if (file.isAbsolute(scriptUrl)) {
        file.openFromUrl(scriptUrl, { zeroBased: true })
      }
    })
    this.task.on('didClose', () => {
      this.toggleButtons.bind(this)(true)
      this.consoleView.info('Atom Bugs: Connection closed')
    })
  }

  destroyTask () {
    if (this.task) {
      this.task.destroy()
    }
    this.task = null
  }

  destroy () {
    this.destroyTask()
    this.subscriptions.dispose()
  }

  indexBreak (filePath, lineNumber) {
    return this.breakpoints.findIndex((item) => {
      return (item.target === filePath && item.line === lineNumber)
    })
  }

  addMarker (editor, lineNumber) {
    let range = [[lineNumber - 1, 0], [lineNumber - 1, 0]]
    let marker = editor.markBufferRange(range)
    return editor.decorateMarker(marker, {
      type: 'line-number',
      class: 'bugs-line-breakpoint'
    })
  }

  bindBreakpoints () {
    let promises = this.breakpoints.map((breakpoint) => {
      return this
        .task
        .setBreakpoint(breakpoint)
        .then((b) => {
          breakpoint.number = b.breakpoint
        })
    })
    return Promise.all(promises)
  }

  addBreak (editor, filePath, lineNumber) {
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

  removeBreakWithIndex (editor, index) {
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

  addButton (element, options) {
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
}
module.exports = BugsView
