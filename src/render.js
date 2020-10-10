const fs = require('fs');

var getTextureOrder = function (live2DModel, partID) {
    // Draw order: larger => smaller
    var modelImpl = live2DModel.getModelImpl();
    let textureOrder = []
    partsDataList = modelImpl._$Xr();
    partsDataList.forEach(element => {
        if (element._$NL.id == partID) {
            element._$aS.forEach(element => {
                textureOrder.push(element._$qb)
            })
        }
    });
    console.log("getTextureOrder",  "partID: " + partID + ", textureOrder:" + textureOrder)
    return textureOrder;
}

var getPartVisibility = function (live2DModel, partID) {
    var modelImpl = live2DModel.getModelImpl();
    partsDataList = modelImpl._$Xr();
    visibility = null;
    partsDataList.forEach(element => {
        if (element._$NL.id == partID) {
            visibility = element.visible;
        }
    });
    console.log("getPartVisibility", "partID: " + partID + ", visibility:" + visibility);
    return visibility;
}

var getPartIDs = function (live2DModel) {
    var modelImpl = live2DModel.getModelImpl();
    let partIDs = [];
    partsDataList = modelImpl._$Xr();
    partsDataList.forEach(element => {
        partIDs.push(element._$NL.id);
    });
    console.log("getPartIds", partsDataList);
    return partIDs;
}

var getParamIDs = function (live2DModel) {
    var modelImpl = live2DModel.getModelImpl();
    let paramIDs = [];
    paramDefSet = modelImpl._$E2()._$4S;
    paramDefSet.forEach(element => {
        paramIDs.push(element._$wL.id);
    });
    console.log("getParamIds", paramIDs);
    return paramIDs;
}

var viewer = function () {

    /*
    * Live2Dモデルのインスタンス
    */
    this.live2DModel = null;

    /*
    * アニメーションを停止するためのID
    */
    this.requestID = null;

    /*
    * モデルのロードが完了したら true
    */
    this.loadLive2DCompleted = false;

    /*
    * モデルの初期化が完了したら true
    */
    this.initLive2DCompleted = false;

    /*
    * WebGL Image型オブジェクトの配列
    */
    this.loadedImages = [];

    /*
    * Live2D モデル設定。
    */

    // Epsilon 2.1モデル
    this.modelDef = {
        "type": "Live2D Model Setting",
        "name": "Epsilon2.1",
        "model": "assets/live2d/Epsilon2.1/Epsilon2.1.moc",
        "textures": [
            "assets/live2d/Epsilon2.1/Epsilon2.1.2048/texture_00.png",
        ]
    };

    // this.modelDef = {
    //     "type": "Live2D Model Setting",
    //     "name": "Haru01",
    //     "model": "assets/live2d/haru/haru_01.moc",
    //     "textures": [
    //         "assets/live2d/haru/haru_01.1024/texture_00.png",
    //         "assets/live2d/haru/haru_01.1024/texture_01.png",
    //         "assets/live2d/haru/haru_01.1024/texture_02.png"
    //     ]
    // };

    // this.modelDef = {
    //     "type": "Live2D Model Setting",
    //     "name": "Haru02",
    //     "model": "assets/live2d/haru/haru_02.moc",
    //     "textures": [
    //         "assets/live2d/haru/haru_02.1024/texture_00.png",
    //         "assets/live2d/haru/haru_02.1024/texture_01.png",
    //         "assets/live2d/haru/haru_02.1024/texture_02.png"
    //     ]
    // };

    // this.modelDef = {
    //     "type": "Live2D Model Setting",
    //     "name": "Shizuku",
    //     "model": "assets/live2d/shizuku/shizuku.moc",
    //     "textures": [
    //         "assets/live2d/shizuku/shizuku.1024/texture_00.png",
    //         "assets/live2d/shizuku/shizuku.1024/texture_01.png",
    //         "assets/live2d/shizuku/shizuku.1024/texture_02.png",
    //         "assets/live2d/shizuku/shizuku.1024/texture_03.png",
    //         "assets/live2d/shizuku/shizuku.1024/texture_04.png",
    //         "assets/live2d/shizuku/shizuku.1024/texture_05.png"
    //     ]
    // };

    // Live2Dの初期化
    Live2D.init();

    // canvasオブジェクトを取得
    this.canvas = document.getElementById("glcanvas");

    this.isPlay = true;
    this.btnPlayPause = document.getElementById("btnPlayPause");
    btnPlayPause.textContent = (isPlay) ? "Pause" : "Play";

    this.frameCount = 0;
    this.gl = null;

    // コンテキストを失ったとき
    canvas.addEventListener("webglcontextlost", function (e) {
        console.log("context lost");
        loadLive2DCompleted = false;
        initLive2DCompleted = false;

        var cancelAnimationFrame =
            window.cancelAnimationFrame ||
            window.mozCancelAnimationFrame;
        cancelAnimationFrame(requestID); //アニメーションを停止

        e.preventDefault();
    }, false);

    // コンテキストが復元されたとき
    canvas.addEventListener("webglcontextrestored", function (e) {
        console.log("webglcontext restored");
        viewer.initLoop(canvas);
    }, false);

    // Init and start Loop
    viewer.initLoop(canvas);
};


/*
* WebGLコンテキストを取得・初期化。
* Live2Dの初期化、描画ループを開始。
*/
viewer.initLoop = function (canvas/*HTML5 canvasオブジェクト*/) {
    //------------ WebGLの初期化 ------------

    // WebGLのコンテキストを取得する
    var para = {
        premultipliedAlpha: true,
        //        alpha : false
    };
    gl = viewer.getWebGLContext(canvas, para);
    if (!gl) {
        console.log("Failed to create WebGL context.");
        return;
    }

    // OpenGLのコンテキストをセット
    Live2D.setGL(gl);

    //------------ Live2Dの初期化 ------------

    // mocファイルからLive2Dモデルのインスタンスを生成
    viewer.loadBytes(modelDef.model, function (buf) {
        live2DModel = Live2DModelWebGL.loadModel(buf);
    });

    // テクスチャの読み込み
    var loadCount = 0;
    for (var i = 0; i < modelDef.textures.length; i++) {
        (function (tno) {// 即時関数で i の値を tno に固定する（onerror用)
            loadedImages[tno] = new Image();
            loadedImages[tno].src = modelDef.textures[tno];
            loadedImages[tno].onload = function () {
                if ((++loadCount) == modelDef.textures.length) {
                    loadLive2DCompleted = true;//全て読み終わった
                }
            }
            loadedImages[tno].onerror = function () {
                console.log("Failed to load image : " + modelDef.textures[tno]);
            }
        })(i);
    }

    //------------ 描画ループ ------------

    (function tick() {
        if (isPlay) {
            viewer.draw(gl); // 1回分描画
        }

        var requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;
        requestID = requestAnimationFrame(tick, canvas);// 一定時間後に自身を呼び出す
    })();
};


viewer.draw = function (gl/*WebGLコンテキスト*/) {
    // 描画エリアをクリア
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Live2D初期化
    if (!live2DModel || !loadLive2DCompleted)
        return; //ロードが完了していないので何もしないで返る

    // ロード完了後に初回のみ初期化する
    if (!initLive2DCompleted) {
        initLive2DCompleted = true;

        // 画像からWebGLテクスチャを生成し、モデルに登録
        for (var i = 0; i < loadedImages.length; i++) {
            //Image型オブジェクトからテクスチャを生成
            var texName = viewer.createTexture(gl, loadedImages[i]);

            live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
        }

        // テクスチャの元画像の参照をクリア
        loadedImages = null;

        // 表示位置を指定するための行列を定義する
        var s = 2.0 / live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
        var matrix4x4 = [
            s, 0, 0, 0,
            0, -s, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ];
        live2DModel.setMatrix(matrix4x4);
    }

    // キャラクターのパラメータを適当に更新
    var fps = 60
    var t = frameCount * (1 / fps) * 2 * Math.PI; //1秒ごとに2π(1周期)増える
    var cycle = 3.0; //パラメータが一周する時間(秒)
    // PARAM_ANGLE_Xのパラメータが[cycle]秒ごとに-30から30まで変化する
    live2DModel.setParamFloat("PARAM_ANGLE_X", 30 * Math.sin(t / cycle));
    live2DModel.setParamFloat("PARAM_EYE_R_OPEN", 1 * Math.sin(t / cycle));
    live2DModel.setParamFloat("PARAM_EYE_L_OPEN", 1 * Math.sin(t / cycle));

    // Live2Dモデルを更新して描画
    live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
    live2DModel.draw();   // 描画

    if (isPlay) {
        frameCount++;
    }
};

viewer.drawElement = function (gl/*WebGLコンテキスト*/, element) {
    // 描画エリアをクリア
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Live2D初期化
    if (!live2DModel || !loadLive2DCompleted)
        return; //ロードが完了していないので何もしないで返る

    // ロード完了後に初回のみ初期化する
    if (!initLive2DCompleted) {
        initLive2DCompleted = true;

        // 画像からWebGLテクスチャを生成し、モデルに登録
        for (var i = 0; i < loadedImages.length; i++) {
            //Image型オブジェクトからテクスチャを生成
            var texName = viewer.createTexture(gl, loadedImages[i]);

            live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
        }

        // テクスチャの元画像の参照をクリア
        loadedImages = null;

        // 表示位置を指定するための行列を定義する
        var s = 2.0 / live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
        var matrix4x4 = [
            s, 0, 0, 0,
            0, -s, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ];
        live2DModel.setMatrix(matrix4x4);
    }

    // Live2Dモデルを更新して描画
    live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
    live2DModel.drawElement(element);   // 描画
};

/*
* WebGLのコンテキストを取得する
*/
viewer.getWebGLContext = function (canvas/*HTML5 canvasオブジェクト*/) {
    var NAMES = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];

    var param = {
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true
    };

    for (var i = 0; i < NAMES.length; i++) {
        try {
            var ctx = canvas.getContext(NAMES[i], param);
            if (ctx) return ctx;
        }
        catch (e) { }
    }
    return null;
};


/*
* Image型オブジェクトからテクスチャを生成
*/
viewer.createTexture = function (gl/*WebGLコンテキスト*/, image/*WebGL Image*/) {
    var texture = gl.createTexture(); //テクスチャオブジェクトを作成する
    if (!texture) {
        console.log("Failed to generate gl texture name.");
        return -1;
    }

    if (live2DModel.isPremultipliedAlpha() == false) {
        // 乗算済アルファテクスチャ以外の場合
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);	//imageを上下反転
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
};


/*
* ファイルをバイト配列としてロードする
*/
viewer.loadBytes = function (path, callback) {
    var request = new XMLHttpRequest();
    request.open("GET", path, true);
    request.responseType = "arraybuffer";
    request.onload = function () {
        switch (request.status) {
            case 200:
                callback(request.response);
                break;
            default:
                console.log("Failed to load (" + request.status + ") : " + path);
                break;
        }
    }

    request.send(null);
};

viewer.save = function (path = "image.png") {
    var img = canvas.toDataURL();
    var data = img.replace(/^data:image\/\w+;base64,/, "");
    var buf = Buffer.from(data, 'base64');
    fs.writeFileSync(path, buf);
}

viewer.saveLayerV2 = function () {
    prevIsPlay = isPlay;
    isPlay = false;
    elementList = live2DModel.getElementList();
    elementList.forEach((e, index) => {
        viewer.drawElement(gl, e.element);
        var order = ("000" + index).slice(-4);
        viewer.save(order + '_' + e.partID + ".png");
    })
    viewer.draw(gl);
    viewer.save("all.png");
    isPlay = prevIsPlay;
}

viewer.togglePlayPause = function () {
    isPlay = !isPlay;
    btnPlayPause.textContent = (isPlay) ? "Pause" : "Play";
}

viewer.secret = function () {
    getPartIDs(live2DModel);
    getParamIDs(live2DModel);

    var modelImpl = live2DModel.getModelImpl();
    parts = modelImpl._$F2;
    partsCount = parts.length;
    var elementCount = 0;
    parts.forEach(element => {
        console.log(element.getDrawData());
        elementCount += element.getDrawData().length;
    })
    console.log("partCount", partsCount);
    console.log("elementCount", elementCount);
}