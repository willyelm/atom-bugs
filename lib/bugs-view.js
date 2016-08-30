/* global atom */
/**
 * Bugs View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const path = require('path')
const chokidar = require('chokidar')
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
    this.panelView = atom.workspace.addHeaderPanel({
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
    this.consoleView.on('didRemoveBreak', (breakpoint) => {
      let index = this.breakpoints.indexOf(breakpoint)
      this.removeBreakWithIndex(null, index)
    })
    this.consoleView.on('didEnterText', (expression) => {
      let insert = (res) => {
        let element = BugsOverlayView.inspect(res, { fromSource: expression })
        this.consoleView.addElement(element)
      }
      if (this.task) {
        this
          .task
          .evaluate(expression)
          .then(insert)
          .catch(insert)
      } else {
        this.consoleView.info(`Cannot evaluate "${expression}" without a connection.`)
      }
    })
    this.schemeView.on('didSelectScheme', this.changeScheme.bind(this))
    this.schemeView.on('didCloseScheme', this.changeScheme.bind(this))
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
    this.restartButton = this.addButton(this.controls, {
      icon: 'bugs-icon-refresh',
      action: this.restartTask.bind(this)
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
    // this.controls.removeChild(this.pauseButton)
    this.controls.removeChild(this.restartButton)
    this.resumeButton.disabled = true
    this.stepInButton.disabled = true
    this.stepOutButton.disabled = true
    this.nextButton.disabled = true
    // breakpoints
    this.breakpoints = []
  }

  observe () {
    // observer active editor
    atom.workspace.observeActivePaneItem((editor = {}) => {
      if (!editor.getPath) return
      let sourceFile = editor.getPath()
      // determine if run should be enabled
      let scheme = this.schemeView.getSelectedScheme()
      this.determineRunInability(scheme)
      // restore breakpoints
      _(this.breakpoints)
        .filter((b) => {
          return (b.target === sourceFile)
        })
        .forEach((b) => {
          if (b.marker) {
            b.marker.destroy()
          }
          let marker = this.addMarker(editor, b.line)
          b.marker = marker.decorator
        })
    })
    atom.workspace.observeTextEditors((editor = {}) => {
      if (!editor.getPath) return
      let sourceFile = editor.getPath()
      // attach breakpoints to javascript files only
      if (this.isEnabledEditor(editor)) {
        // attach breakpoint handlers
        editor.editorElement.shadowRoot.addEventListener('click', (e) => {
          let element = e.target
          let isBreakpoint = element.classList.contains('atom-bugs-breakpoint')
          if (isBreakpoint) {
            element = e.target.parentNode
          }
          if (element.classList.contains('line-number')) {
            // toggle breakpoints
            let lineNumber = Number(element.textContent)
            let currentIndex = this.indexBreak(sourceFile, lineNumber)
            if (currentIndex >= 0) {
              this.removeBreakWithIndex(editor, currentIndex)
            } else {
              this.addBreak(editor, sourceFile, lineNumber)
            }
          }
        })
        // attach expression evaluator
        let overlayView
        let evaluateHandler
        editor.onDidChangeSelectionRange((event, t) => {
          // remove previous decorator
          if (overlayView) {
            overlayView.destroy()
            overlayView = null
          }
          clearTimeout(evaluateHandler)
          evaluateHandler = setTimeout(() => {
            if (this.currentBreakFile) {
              let isFileBreak = this.currentBreakFile.match(sourceFile)
              if (isFileBreak) {
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
              }
            }
          }, 650)
        })
      }
    })
    // atom.workspace.observeTextEditors((editor) => {})
    let buildProjectPaths = (projectPaths) => {
      // empty previous items
      this.projectSelect.innerHTML = ''
      _.forEach(projectPaths, (url) => {
        let option = document.createElement('option')
        let projectPath = path.parse(url)
        option.value = url
        option.innerHTML = projectPath.name
        this.projectSelect.appendChild(option)
      })
      this.projectSelect.addEventListener('change', (e) => {
        this.schemeView.useSettingFromProject(this.projectSelect.value)
      })
      // use current project
      if (projectPaths.length > 0) {
        this.projects.appendChild(this.projectButton)
        this.schemeView.useSettingFromProject(projectPaths[0])
      } else if (this.projectButton.parentNode) {
        this.projects.removeChild(this.projectButton)
        this.schemeView.useSettingFromProject('schemes')
      }
    }
    // fill projects
    buildProjectPaths(atom.project.getPaths())
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
      // watcher
      if (this.watcher) {
        this.watcher.close()
      }
      if (_.get(scheme, 'fields.watch.active')) {
        let target = file.normalize(scheme.fields.watch.value, {
          fromPath: this.projectSelect.value
        })
        // watch changes
        this.watcher = chokidar.watch(target, {
          ignored: [/[\/\\]\./, /node_modules/, /bower_components/]
        })
        this.watcher
          .on('change', this.restartTask.bind(this))
          .on('unlink', this.restartTask.bind(this))
      }
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
      // this.controls.removeChild(this.pauseButton)
      this.controls.removeChild(this.restartButton)
    } else if (this.runButton.parentNode) {
      this.controls.removeChild(this.runButton)
      this.controls.appendChild(this.stopButton)
      // this.controls.appendChild(this.pauseButton)
      this.controls.appendChild(this.restartButton)
    }
    this.schemeButton.disabled = !enable
    this.resumeButton.disabled = enable
    this.stepInButton.disabled = enable
    this.stepOutButton.disabled = enable
    this.nextButton.disabled = enable
  }

  restartTask () {
    return new Promise((resolve) => {
      if (this.task) {
        this.destroyTask(500).then(() => {
          this.startTask()
          resolve()
        })
      }
    })
  }

  startTask () {
    return this.destroyTask().then(() => {
      this.consoleView.clear()
      let scheme = this.schemeView.getSelectedScheme()
      let promise
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
        this.currentBreakFile = scriptUrl
        this.consoleView.breakpoint(scriptUrl)
        if (file.isAbsolute(scriptUrl)) {
          file.openFromUrl(scriptUrl, { zeroBased: true })
        }
      })
      this.task.on('didClose', () => {
        this.toggleButtons.bind(this)(true)
        this.consoleView.info('Atom Bugs: Connection closed')
      })
    })
  }

  destroyTask (timeout = 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.task) {
          this.task.destroy()
        }
        this.task = null
        resolve()
      }, timeout)
    })
  }

  destroy () {
    this.panelView.destroy()
    this.schemeView.destroy()
    this.consoleView.destroy()
    this.destroyTask().then(() => {
      this.subscriptions.dispose()
    })
  }

  indexBreak (filePath, lineNumber) {
    return this.breakpoints.findIndex((item) => {
      return (item.target === filePath && item.line === lineNumber)
    })
  }

  removeMarker (editor, lineNumber) {
    editor
  }

  addMarker (editor, lineNumber) {
    let range = [[lineNumber - 1, 0], [lineNumber - 1, 0]]
    let marker = editor.markBufferRange(range)
    let decorator = {
      marker: marker,
      decorator: editor.decorateMarker(marker, {
        type: 'line-number',
        class: 'bugs-line-breakpoint'
      })
    }
    return decorator
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
    let highlight = this.addMarker(editor, lineNumber)
    let breakpoint = {
      target: filePath,
      line: lineNumber,
      marker: highlight.decorator
    }
    highlight.marker.onDidChange((position) => {
      breakpoint.line = position.newHeadBufferPosition.row + 1
    })
    this.breakpoints.push(breakpoint)
    this.consoleView.breakpoints(this.breakpoints)
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
        if (breakpoint.marker) {
          breakpoint.marker.destroy()
        }
        this.breakpoints.splice(index, 1)
        this.consoleView.breakpoints(this.breakpoints)
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
