/* global atom, btoa */
/**
 * Bugs Scheme View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
// Using JSON files to store the scheme project references
// TODO: Use NeDB(something like sqlite but as mongodb) to store the settings.
const BugsSchemeEditor = require('./editor')
const Schemes = require('../resources/data/schemes.json')

class BugsSchemeView extends EventEmitter {

  constructor () {
    super()
    this.editor = new BugsSchemeEditor()
    this.editor.on('save', this.save.bind(this))
    this.editor.on('didHit', this.hide.bind(this))
    let panel = document.createElement('atom-bugs-schemes')
    panel.className = 'settings-view native-key-bindings'
    panel.innerHTML = `
    <div class="atom-bugs-scheme-selector">
      <div class="btn-group">
        <button type="button" target="currentFile" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-file-code-o"></i> Current File
        </button>
        <button type="button" target="workspace" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-flask"></i>  Workspace
        </button>
        <button type="button" target="remote" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-wifi"></i>  Remote
        </button>
        <button type="button" target="chrome" class="atom-bugs-scheme-select btn btn-default">
          <i class="bugs-icon-chrome"></i> Google Chrome
        </button>
      </div>
    </div>
    <div class="atom-bugs-scheme-configurator">
      <form></form>
      <div class="text-center">
        <button type="button" id="closeButton" class="btn btn-default">
          <span class="icon-check"></span> Close Scheme Editor
        </button>
      </div>
    </div>`
    this.formView = panel.querySelector('form')
    this.buttonsView = panel.querySelector('.atom-bugs-scheme-selector .btn-group')
    let selectors = Array.from(this.buttonsView.querySelectorAll('.atom-bugs-scheme-select'))
    let closeButton = panel.querySelector('#closeButton')
    // attach scheme open
    closeButton.addEventListener('click', this.hide.bind(this))
    selectors.forEach((b) => {
      b.addEventListener('click', () => {
        this.activateSchemeButton(b)
        let index = b.getAttribute('target')
        _.forEach(this.currentScheme, (s, key) => {
          s.selected = (key === index)
        })
        this.save()
        this.editFromIndex(index)
      })
    })
    this.currentScheme = {}
    this.panelView = atom.workspace.addModalPanel({
      item: panel,
      visible: false
    })
  }

  activateSchemeButton (button) {
    if (button) {
      let selectors = Array.from(this.buttonsView.querySelectorAll('.atom-bugs-scheme-select'))
      selectors.forEach((ob) => {
        ob.classList.remove('active')
      })
      button.classList.add('active')
    }
  }

  show () {
    let selectedIndex = _.findKey(this.currentScheme, {
      selected: true
    }) || 'currentFile'
    let button = this.buttonsView.querySelector(`button[target="${selectedIndex}"]`)
    this.activateSchemeButton(button)
    this.editFromIndex(selectedIndex)
    this.panelView.show()
  }

  hide () {
    this.emit('didCloseScheme', this.currentScheme[this.currentIndex])
    this.panelView.hide()
  }

  destroy () {
    // destroy
    this.editor = null
    this.panelView.destroy()
  }

  setSchemeFromString (data, copy = false) {
    return new Promise((resolve, reject) => {
      let json = JSON.parse(String(data))
      if (copy) {
        this.currentScheme = _.clone(Schemes)
        // copy only selected and fields value
        _.forEach(this.currentScheme, (settings, name) => {
          settings.selected = _.get(json, `${name}.selected`, false)
          _.forEach(settings.fields, (field, key) => {
            field.active = _.get(json, `${name}.fields.${key}.active`, null)
            field.value = _.get(json, `${name}.fields.${key}.value`, null)
          })
        })
      } else {
        this.currentScheme = json
      }
      let selected = this.getSelectedScheme()
      this.emit('didSelectScheme', selected)
      // this.emit('didUpdateScheme', selected)
      resolve(selected)
    })
  }

  useSettingFromProject (projectPath) {
    return new Promise((resolve, reject) => {
      let schemeFile
      if (projectPath !== 'schemes') {
        schemeFile = btoa(projectPath)
      }
      this.filePath = path.join(__dirname, `../resources/data/${schemeFile}.json`)
      fs.readFile(this.filePath, (err, data) => {
        if (err) {
          let template = path.join(__dirname, '../resources/data/schemes.json')
          fs.readFile(template, (e, templateData) => {
            resolve(this.setSchemeFromString(templateData))
          })
        } else {
          resolve(this.setSchemeFromString(data, true))
        }
      })
    })
  }

  save () {
    return new Promise((resolve, reject) => {
      if (this.filePath) {
        fs.writeFile(this.filePath, JSON.stringify(this.currentScheme, null, 2), (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      }
    })
  }

  getSelectedScheme () {
    let selected = _.find(this.currentScheme, {
      selected: true
    })
    return selected || null
  }

  editFromIndex (index) {
    // clear previous elements
    this.formView.innerHTML = ''
    // build form from scheme
    this.currentIndex = index
    let scheme = this.currentScheme[index]
    this.emit('didSelectScheme', scheme)
    if (scheme) {
      let promises = _.map(scheme.fields, (field, name) => {
        let promise
        switch (field.type) {
          case 'list':
            promise = this.editor.createList(field)
            break
          case 'object':
            promise = this.editor.createObject(field)
            break
          case 'file':
            promise = this.editor.createFile(field)
            break
          case 'text':
            promise = this.editor.createText(field)
            break
        }
        promise.then((group) => {
          this.formView.appendChild(group)
        })
      })
      promises.reduce((p, f) => p.then(f), Promise.resolve())
      // Promise.resolve().then(func1).then(func2)
    }
  }
}

module.exports = BugsSchemeView
