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
    // this.consoleView.on('didEnterText', (expression) => {
    // })
    this.schemeView.on('didSelectScheme', this.changeScheme.bind(this))
    function toggleButtons (enable) {
      if (enable && this.stopButton.parentNode) {
        controls.appendChild(this.runButton)
        controls.removeChild(this.stopButton)
      } else if (this.runButton.parentNode) {
        controls.removeChild(this.runButton)
        controls.appendChild(this.stopButton)
      }
      this.schemeButton.disabled = !enable
      this.resumeButton.disabled = enable
      this.stepInButton.disabled = enable
      this.stepOutButton.disabled = enable
      this.clearButton.disabled = enable
      this.nextButton.disabled = enable
    }
    // run button
    this.runButton = this.addButton(controls, {
      icon: 'bugs-icon-play',
      action () {
        this.destroyTask()
        toggleButtons.bind(this)(false)
        this.consoleView.clear()
        let scheme = this.schemeView.getSelectedScheme()
        // console.log('run with scheme', scheme)
        switch (scheme.title) {
          case 'Chrome':
            this.task = new Bugs.Chrome()
            this.task
              .runBrowser({
                target: scheme.fields.target.value,
                sources: scheme.fields.path.value,
                url: scheme.fields.url.value,
                cwd: this.projectSelect.value
              })
              .then(() => {
                return this.bindBreakpoints()
              })
              .catch((message) => {
                atom.notifications.addFatalError('Atom Bugs', {
                  detail: message,
                  icon: 'bug',
                  dismissable: true
                })
              })
            break
          case 'Remote':
            this.task = new Bugs.Node({
              hostname: scheme.fields.hostname.value,
              port: scheme.fields.port.value
            })
            this
              .task
              .connect()
              .then(() => {
                return this.bindBreakpoints()
              })
              .catch((message) => {
                atom.notifications.addFatalError('Atom Bugs', {
                  detail: message,
                  icon: 'bug',
                  dismissable: true
                })
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
            this
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
              .catch((message) => {
                atom.notifications.addFatalError('Atom Bugs', {
                  detail: message,
                  icon: 'bug',
                  dismissable: true
                })
              })
        }

        this.task.on('didGetMessage', this.consoleView.log.bind(this.consoleView))
        this.task.on('didEndMessage', this.consoleView.log.bind(this.consoleView))
        this.task.on('didGetError', this.consoleView.error.bind(this.consoleView))
        this.task.on('didEndError', this.consoleView.error.bind(this.consoleView))
        this.task.on('didBreak', this.consoleView.breakpoint.bind(this.consoleView))
        this.task.on('didClose', () => {
          this.consoleView.clear()
          toggleButtons.bind(this)(true)
          atom.notifications.addWarning('Atom Bugs: Connection closed', {
            icon: 'bug',
            dismissable: true
          })
        })
      }
    })
    // stop button
    this.stopButton = this.addButton(controls, {
      icon: 'bugs-icon-stop',
      action () {
        this.destroyTask()
      }
    })
    // resume button
    this.resumeButton = this.addButton(actions, {
      icon: 'bugs-icon-fast-forward',
      tooltip: 'Resume',
      action () {
        this.task.resume()
      }
    })
    // next button
    this.nextButton = this.addButton(actions, {
      icon: 'bugs-icon-step-forward',
      tooltip: 'Next',
      action () {
        this.task.step('next', 1)
      }
    })
    // step in button
    this.stepInButton = this.addButton(actions, {
      icon: 'bugs-icon-long-arrow-up',
      tooltip: 'Step In',
      action () {
        this.task.step('in', 1)
      }
    })
    // step out button
    this.stepOutButton = this.addButton(actions, {
      icon: 'bugs-icon-long-arrow-down',
      tooltip: 'Step Out',
      action () {
        this.task.step('out', 1)
      }
    })
    // clear console button
    this.clearButton = this.addButton(extendedActions, {
      icon: 'bugs-icon-terminal',
      tooltip: 'Clear Console',
      action () {
        this.consoleView.clear()
      }
    })
    // disable task required buttons
    controls.removeChild(this.stopButton)
    this.resumeButton.disabled = true
    this.stepInButton.disabled = true
    this.stepOutButton.disabled = true
    this.clearButton.disabled = true
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
      // get word from cursor
      // editor.onDidChangeCursorPosition((event) => {
      //   if (this.task) {
      //     let range = event.cursor.getCurrentWordBufferRange()
      //     let word = editor.getTextInBufferRange(range)
      //     console.log('word', word)
      //   }
      // })
      // attach breakpoints to javascript files only
      if (this.isEnabledEditor(editor)) {
        let decorator
        let evaluateHandler
        // attach expression evaluator
        editor.onDidChangeSelectionRange((event) => {
          clearTimeout(evaluateHandler)
          evaluateHandler = setTimeout(() => {
            // remove previos decorator
            if (decorator) {
              decorator.destroy()
            }
            // has selected range
            let range = event.selection.getScreenRange()
            if (this.task && range && range.start.row === range.end.row) {
              let text = editor.getTextInBufferRange(range)
              if (text && text.length > 0) {
                let marker = editor.markBufferRange(range)
                let panel = document.createElement('bugs-evaluate-panel')
                decorator = editor.decorateMarker(marker, {
                  type: 'overlay',
                  class: 'bugs-evaluate-expression',
                  item: panel
                })
                this
                  .task
                  .evaluate(text)
                  .then((result) => {
                    panel.innerHTML = result
                  })
                  .catch((message) => {
                    panel.innerHTML = message
                    // this.consoleView.error(message)
                  })
              }
            }
          }, 200)
        })
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
      // empty previous items
      self.projectSelect.innerHTML = ''
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
        self.schemeView.useSettingFromProject('schemes')
      }
    }
    // fill projects
    let projectPaths = atom.project.getPaths()
    buildProjectPaths(projectPaths)
    // check for projects paths
    atom.project.onDidChangePaths(buildProjectPaths)
  }

  isEnabledEditor (editor) {
    if (!editor && !editor.getGrammar) return false
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

  destroyTask () {
    this.consoleView.hide()
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
