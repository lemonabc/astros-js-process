'use strict';

let nodeUrl = require('url');
let nodePath = require('path');
let nodeFs = require('fs');
let nodeUtil = require('util');

let util = require('lang-utils');

module.exports = new astro.Middleware({
    modType: 'page',
    fileType: 'js'
}, function(asset, next) {
    let project = asset.project,
        self    = this,
        prjCfg  = Object.assign({
        source: {},
        unCombine: []
    }, asset.prjCfg),
    // 加载Web组件JS
        webComCode = '',
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

    let reader = astro.Asset.getContents(components||[]);
    reader.then(function(assets) {
        let wcError = '';
        assets.forEach(function(ast) {
            if (!ast.data)
                wcError += ['/* webCom:' + ast.filePath + ' is miss */', ''].join('\n');
            else {
                webComCode += '/* ' + ast.filePath + ' */\n' + ast.data + '\n';
            }
        });
        asset.data = webComCode + '\n/* ' + asset.filePath + ' */\n'+ (asset.data || '');
        // 读取依赖组件
        asset.jsLibs = asset.jsLibs || ['',[]];
        let jsLibCode = '',
            ignore_require = [],
            combined = [],
            errorMsg = asset.jsLibs[0] || '',
            jsLibs = asset.jsLibs[1] || [];
        // 加载所有JS组件
        let _jsLibs = [];
        jsLibs.forEach(function(js) {
            if (util.inArray(js, self.config.ignore_require)) {
                ignore_require.push(prjCfg.source[js] || js);
            } else {
                combined.push(js);
                _jsLibs.push(new astro.Asset({
                    ancestor: asset,
                    modType: 'jsCom',
                    fileType: 'js',
                    name: js,
                    project: project
                }));
            }
        });
        let reader = astro.Asset.getContents(_jsLibs);
        reader.then(function(assets) {
            try{
                assets.forEach(function(at) {
                    if (at.data) {
                        jsLibCode += ['', '/* ' + at.filePath + ' */', at.data, ''].join('\n');
                        return;
                    }
                    errorMsg += nodeUtil.format('\n/* jsLib(%s) is miss, project:%s */', asset.info, project);
                });

                jsLibCode = '/* jsCom:' + combined.join(',') + ' */ \n' + jsLibCode + '\n';
                // jsLibCode = '/* ignore_require:' + ignore_require.join(',') + ' */\n/* jsCom:' + combined.join(',') + ' */ \n' + jsLibCode + '\n';

                if(self.format!=false){
                    asset.data =  require('js-beautify').js_beautify([wcError, errorMsg, jsLibCode, asset.data||'/*empty*/'].join('\n'));
                }else{
                    asset.data =  [wcError, errorMsg, jsLibCode, asset.data||'/*empty*/'].join('\n');
                }
            }catch(e){
                console.error('astro-js-proces\n',e.stack);
            }
            next(asset);
        })
    }).catch(function(error) {
        console.error('astro-js-process', error);
        asset.data = error + '\n' + asset.data
        next(asset);
    });
});