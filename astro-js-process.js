'use strict';

var nodeUrl = require('url');
var nodePath = require('path');
var nodeFs = require('fs');
var nodeUtil = require('util');

var util = require('lang-utils');

module.exports = new astro.Middleware({
    modType: 'page',
    fileType: 'js'
}, function(asset, next) {
    var project = asset.project;

    var prjCfg = Object.assign({
        source: {},
        unCombine: []
    }, asset.prjCfg);
    // 加载Web组件JS
    let webComCode = '',
        components = [];

    if (asset.components && asset.components.length) {
        components = asset.components.map(function(wc) {
            return new astro.Asset({
                ancestor: asset,
                project: project,
                modType: 'webCom',
                name: wc,
                fileType: 'js'
            });
        })
    }
    let reader = astro.Asset.getContents(components);
    reader.then(function(assets) {
        var wcError = '';
        assets.forEach(function(ast) {
            if (!ast.data)
                wcError += ['/* ', 'webCom:' + ast.filePath + ' is miss */', ''].join('\n');
            else {
                webComCode += '/* ' + ast.filePath + ' */\n' + ast.data + '\n';
            }
        });
        asset.data = webComCode + (asset.data || '');
        // 读取依赖组件
        asset.jsLibs = asset.jsLibs || [];
        let jsLibCode = '',
            unCombined = [],
            combined = [],
            errorMsg = asset.jsLibs[0] || '',
            jsLibs = asset.jsLibs[1] || [];
        // 加载所有JS组件
        jsLibs = jsLibs.map(function(js) {
            if (util.inArray(js, prjCfg.unCombined)) {
                unCombined.push(prjCfg.source[js] || js);
            } else {
                combined.push(js);
                return new astro.Asset({
                    ancestor: asset,
                    modType: 'jsCom',
                    fileType: 'js',
                    name: js,
                    project: project
                });
            }
        });
        let reader = astro.Asset.getContents(jsLibs);
        reader.then(function(assets) {
            assets.forEach(function(at) {
                if (at.data) {
                    jsLibCode += ['', '/* ' + at.filePath + ' */', at.data, ''].join('\n');
                    return;
                }
                errorMsg += nodeUtil.format('\n/* jsLib(%s) is miss, project:%s */', js, project);
            });
            jsLibCode = '/* unCombined:' + unCombined.join(',') + ' */\n/* jsCom:' + combined.join(',') + ' */ \n' + jsLibCode + '\n';
            asset.data = [wcError, errorMsg, jsLibCode, '/* ' + asset.filePath + ' */', asset.data||''].join('\n');
            next(asset);
        })
    }).catch(function(error) {
        console.error('astro-js-process', error);
        asset.data = error + '\n' + asset.data
        next(asset);
    });
});