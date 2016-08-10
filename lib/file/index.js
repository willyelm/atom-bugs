/* global atom */
/**
 * Bugs Console View
 * @author Williams Medina <williams.medinaa@gmail.com>
 */
'use strict'

module.exports = {

  normalize (path = '', {fromPath} = {}) {
    let result = String(path).replace(/^~/, process.env.HOME)
    if (result.charAt(0) !== '/') {
      result = (fromPath ? fromPath + '/' : '') + result
    }
    return result
  },

  shortener (fileUrl) {
    if (fileUrl.length > 35) {
      return fileUrl.substr(0, 10) + '...' + fileUrl.substr(fileUrl.length - 20, fileUrl.length)
    }
    return fileUrl
  },

  parse (filePath = '', offset) {
    let source = filePath.split(':')
    let fix = offset || 0
    let position = {
      file: source[0],
      line: Number(source[1]) + fix
    }
    if (source[2]) {
      position.column = Number(source[2]) + fix
    }
    return {
      file: source[0],
      line: Number(source[1] || 0) + fix,
      column: Number(source[2] || 0) + fix
    }
  },

  isRelative (url) {
    return (url.charAt(0) !== '/' &&
      url.charAt(0) !== '~' &&
      url.charAt(0) !== '.')
  },

  isAbsolute (url) {
    return !this.isRelative(url)
  },

  openFromUrl (url, {zeroBased} = {}) {
    // initialLine initialColumn
    let offset = zeroBased ? -1 : 0
    let convert = this.parse(url, offset)
    let position = {
      initialLine: convert.line,
      initialColumn: convert.column
    }
    return atom.workspace.open(convert.file, position)
  },

  convertToOneBased (url) {
    let convert = this.parse(url, 1)
    return `${convert.file}:${convert.line}:${convert.column}`
  },

  convertToZeroBased (url) {
    let convert = this.parse(url, -1)
    return `${convert.file}:${convert.line}:${convert.column}`
  }
}
