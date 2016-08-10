/* global atom */
/**
 * Main
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'
const AtomPackage = require('../package.json')
const BufferedProcess = require('atom').BufferedProcess
const fs = require('fs')
const path = require('path')

module.exports = {

  initialize () {
    const BugsView = require('./bugs-view.js')
    this.debugView = new BugsView()
    this.debugView.observe()
  },

  activate (state) {
    let packagePath = path.join(__dirname, '..')
    let exists = Object
      .keys(AtomPackage.dependencies)
      .map((name) => {
        return new Promise((resolve) => {
          let location = path.join(packagePath, `node_modules/${name}`)
          fs.exists(location, resolve)
        })
      })
    return Promise
      .all(exists)
      .then((values) => {
        if (values.includes(false)) {
          atom.notifications.addInfo('Atom Bugs: Installing', {
            detail: 'Please wait while dependencies are installing.',
            dismissable: false
          })
          let apm = atom.packages.getApmPath()
          let args = ['install']
          let options = {
            cwd: packagePath
          }
          return new BufferedProcess({
            command: apm,
            args,
            exit: this.initialize.bind(this),
            options})
        } else {
          this.initialize()
        }
      })
  },

  deactivate () {
    this.debugView.destroy()
  }
}
