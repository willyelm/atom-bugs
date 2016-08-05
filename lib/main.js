/**
 * Main
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

const BugsView = require('./bugs-view.js')

module.exports = {
  debugView: new BugsView(),
  activate (state) {
    this.debugView.observe()
  },
  deactivate () {
    this.debugView.destroy()
  }
}
