const fs = require("fs");
const path = require("path");
const nativeTheme = require("electron");

nativeTheme.themeSource = "dark";

var thisRef = this;

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

// JavaScriptで発生したエラーを取得
window.onerror = function (msg, url, line, col, error) {
    var errmsg = "file:" + url + "<br>line:" + line + " " + msg;
    l2dError(errmsg);
}

function viewer() {
    this.platform = window.navigator.platform.toLowerCase();

    this.live2DMgr = new LAppLive2DManager();

    this.isDrawStart = false;

    this.gl = null;
    this.canvas = null;

    this.dragMgr = null; /*new L2DTargetPoint();*/ // ドラッグによるアニメーションの管理
    this.viewMatrix = null; /*new L2DViewMatrix();*/
    this.projMatrix = null; /*new L2DMatrix44()*/
    this.deviceToScreen = null; /*new L2DMatrix44();*/

    this.drag = false; // ドラッグ中かどうか
    this.oldLen = 0;    // 二本指タップした時の二点間の距離

    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.isModelShown = false;

    this.isPlay = true;
    this.frameCount = 0;

    this.btnGoto = document.getElementById("btnGoto");
    this.btnGoto.addEventListener("click", function (e) { goto() })

    this.btnPlayPause = document.getElementById("btnPlayPause");
    this.btnPlayPause.addEventListener("click", function (e) { viewer.togglePlayPause() })
    this.btnPlayPause.textContent = (this.isPlay) ? "Pause" : "Play";

    this.btnSave = document.getElementById("btnSave");
    this.btnSave.addEventListener("click", function (e) { viewer.save() })

    this.btnSaveLayer = document.getElementById("btnSaveLayer");
    this.btnSaveLayer.addEventListener("click", function (e) { viewer.saveLayer() })

    this.btnSecret = document.getElementById("btnSecret");
    this.btnSecret.addEventListener("click", function (e) { viewer.secret() })

    this.invalidList = [];
    if (fs.existsSync("invalid")) {
        this.invalidList = fs.readFileSync("invalid").toString().split("\n");
    }

    // モデル描画用canvasの初期化
    initL2dCanvas("glcanvas");

    // モデル用マトリクスの初期化と描画の開始
    init();
}

viewer.save = function (path = "image.png") {
    var img = canvas.toDataURL();
    var data = img.replace(/^data:image\/\w+;base64,/, "");
    var buf = Buffer.from(data, "base64");
    fs.writeFileSync(path, buf);
}

viewer.saveLayer = function () {
    prevIsPlay = isPlay;
    isPlay = false;
    live2DModel = live2DMgr.getModel(0).live2DModel;
    elementList = live2DModel.getElementList();
    elementList.forEach((e, index) => {
        drawElement(e.element);
        var order = ("000" + index).slice(-4);
        viewer.save(order + "_" + e.partID + ".png");
    })
    draw(gl);
    viewer.save("all.png");
    isPlay = prevIsPlay;
}

viewer.togglePlayPause = function () {
    isPlay = !isPlay;
    btnPlayPause.textContent = (isPlay) ? "Pause" : "Play";
}

viewer.secret = function () {
    live2DModel = live2DMgr.getModel(0).live2DModel;
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

function loadModel(filelist) {
    let modelJsonList = [];
    filelist.forEach((filepath) => {
        if (filepath.endsWith(".moc")) {
            modelJson = getJson(filepath);
            if (modelJson) {
                modelJsonList.push(...modelJson);
            }
        }
    })
    modelJsonList = [...new Set(modelJsonList)];
    modelJsonList = modelJsonList.filter(
        function (e) {
            return this.indexOf(e) < 0;
        },
        this.invalidList
    );
    console.log("loadModel", modelJsonList.length + " model loaded");
    return modelJsonList;
}

function flagInvalid() {
    var totalModelNo = this.live2DMgr.modelJsonList.length;
    var count = this.live2DMgr.count;
    if (count < 0) count = 0;
    var curModelNo = parseInt(count % totalModelNo);
    var curModelPath = this.live2DMgr.modelJsonList[curModelNo];
    fs.appendFileSync("invalid", curModelPath + '\n');
    console.log('flagInvalid', 'Flagged ' + curModelPath);
}

function goto() {
    const no = parseInt(this.document.getElementById('editGoto').value);
    this.live2DMgr.count = no;
    changeModel(false);
}

function getJson(mocPath) {
    pardir = path.dirname(mocPath);
    let textures = [];
    let motions = [];
    let physics = [];
    let modelJson = [];
    walkdir(pardir, function (filepath) {
        if (filepath.endsWith(".png")) {
            textures.push(filepath.replace(pardir + '/', ''));
        } else if (filepath.endsWith(".mtn")) {
            motions.push(filepath.replace(pardir + '/', ''));
        } else if (filepath.endsWith("physics") || filepath.endsWith("physics.json")) {
            physics.push(filepath.replace(pardir + '/', ''));
        } else if (filepath.endsWith("model.json")) {
            modelJson.push(filepath);
        }
    })
    if (modelJson.length == 0) {
        if (textures.length == 0) {
            console.warn('getJson', '0 texture found! .moc path: ' + mocPath);
        }
        if (physics.length > 1) {
            console.warn('getJson', 'more than 1 physics found! .moc path: ' + mocPath);
        }
        textures.sort();
        motions.sort();
        var model = {};
        model["version"] = "Sample 1.0.0";
        model["model"] = mocPath.replace(pardir + '/', '');
        model["textures"] = textures;
        if (motions.length > 0) {
            model["motions"] = { "idle": [] };
            motions.forEach(motion => {
                var basename = path.basename(motion, ".mtn");
                if (basename.includes("idle")) {
                    model["motions"]["idle"].push({ "file": motion });
                } else {
                    model["motions"][basename] = { "file": motion };
                }
            })
        }
        json = JSON.stringify(model, null, 3);
        modelJson.push(path.join(pardir, "generated.model.json"));
        fs.writeFileSync(modelJson[0], json);
    }
    return modelJson;
}

function walkdir(dir, callback) {
    console.log("walkdir", dir);
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        var filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walkdir(filepath, callback);
        } else if (stats.isFile()) {
            callback(filepath);
        }
    })
}

function initL2dCanvas(canvasId) {
    // canvasオブジェクトを取得
    this.canvas = document.getElementById(canvasId);

    // イベントの登録
    if (this.canvas.addEventListener) {
        this.canvas.addEventListener("mousewheel", mouseEvent, false);
        this.canvas.addEventListener("click", mouseEvent, false);

        this.canvas.addEventListener("mousedown", mouseEvent, false);
        this.canvas.addEventListener("mousemove", mouseEvent, false);

        this.canvas.addEventListener("mouseup", mouseEvent, false);
        this.canvas.addEventListener("mouseout", mouseEvent, false);
        this.canvas.addEventListener("contextmenu", mouseEvent, false);

        // タッチイベントに対応
        this.canvas.addEventListener("touchstart", touchEvent, false);
        this.canvas.addEventListener("touchend", touchEvent, false);
        this.canvas.addEventListener("touchmove", touchEvent, false);

    }

    btnPrev = document.getElementById("btnPrev");
    btnNext = document.getElementById("btnNext");
    btnPrev.addEventListener("click", function (e) {
        changeModel(false);
    });
    btnNext.addEventListener("click", function (e) {
        changeModel();
    });


    document.addEventListener("keydown", function (e) {
        var keyCode = e.keyCode;
        if (keyCode == 90) {
            // z key
            changeModel(false)
        }
        else if (keyCode == 88) {
            // x key
            changeModel();
        }
        else if (keyCode == 32) {
            flagInvalid();
        }
    })

}

function init() {
    // Load all models
    const root = "assets/Live2d-model";
    let filelist = [];
    walkdir(root, function (filepath) { filelist.push(filepath) });
    this.live2DMgr.setModelJsonList(loadModel(filelist));

    // 3Dバッファの初期化
    var width = this.canvas.width;
    var height = this.canvas.height;

    this.dragMgr = new L2DTargetPoint();

    // ビュー行列
    var ratio = height / width;
    var left = LAppDefine.VIEW_LOGICAL_LEFT;
    var right = LAppDefine.VIEW_LOGICAL_RIGHT;
    var bottom = -ratio;
    var top = ratio;

    this.viewMatrix = new L2DViewMatrix();

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    this.viewMatrix.setScreenRect(left, right, bottom, top);

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    this.viewMatrix.setMaxScreenRect(LAppDefine.VIEW_LOGICAL_MAX_LEFT,
        LAppDefine.VIEW_LOGICAL_MAX_RIGHT,
        LAppDefine.VIEW_LOGICAL_MAX_BOTTOM,
        LAppDefine.VIEW_LOGICAL_MAX_TOP);

    this.viewMatrix.setMaxScale(LAppDefine.VIEW_MAX_SCALE);
    this.viewMatrix.setMinScale(LAppDefine.VIEW_MIN_SCALE);

    this.projMatrix = new L2DMatrix44();
    this.projMatrix.multScale(1, (width / height));

    // マウス用スクリーン変換行列
    this.deviceToScreen = new L2DMatrix44();
    this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
    this.deviceToScreen.multScale(2 / width, -2 / width);


    // WebGLのコンテキストを取得する
    this.gl = getWebGLContext();
    if (!this.gl) {
        l2dError("Failed to create WebGL context.");
        return;
    }
    // OpenGLのコンテキストをセット
    Live2D.setGL(this.gl);

    // 描画エリアを白でクリア
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);

    changeModel();

    startDraw();
}


function startDraw() {
    if (!this.isDrawStart) {
        this.isDrawStart = true;
        (function tick() {
            if (this.isPlay) {
                draw(); // 1回分描画
            }

            var requestAnimationFrame =
                window.requestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.msRequestAnimationFrame;

            // 一定時間後に自身を呼び出す
            requestAnimationFrame(tick, this.canvas);
        })();
    }
}


function draw() {
    // l2dLog("--> draw()");

    MatrixStack.reset();
    MatrixStack.loadIdentity();

    this.dragMgr.update(); // ドラッグ用パラメータの更新
    this.live2DMgr.setDrag(this.dragMgr.getX(), this.dragMgr.getY());

    // Canvasをクリアする
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    MatrixStack.multMatrix(projMatrix.getArray());
    MatrixStack.multMatrix(viewMatrix.getArray());
    MatrixStack.push();

    for (var i = 0; i < this.live2DMgr.numModels(); i++) {
        var model = this.live2DMgr.getModel(i);

        if (model == null) return;

        if (model.initialized && !model.updating) {
            model.update(this.frameCount);
            model.draw(this.gl);

            if (!this.isModelShown && i == this.live2DMgr.numModels() - 1) {
                this.isModelShown = !this.isModelShown;
                var btnPrev = document.getElementById("btnPrev");
                btnPrev.removeAttribute("disabled");
                btnPrev.setAttribute("class", "active");

                var btnNext = document.getElementById("btnNext");
                btnNext.removeAttribute("disabled");
                btnNext.setAttribute("class", "active");
            }
        }
    }

    MatrixStack.pop();

    if (this.isPlay) {
        this.frameCount++;
    }
}

function drawElement(element) {
    // Canvasをクリアする
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    for (var i = 0; i < this.live2DMgr.numModels(); i++) {
        var model = this.live2DMgr.getModel(i);
        if (model == null) return;
        model.drawElement(this.gl, element);
    }

}


function changeModel(isNext = true) {
    var btnPrev = document.getElementById("btnPrev");
    btnPrev.setAttribute("disabled", "disabled");
    btnPrev.setAttribute("class", "inactive");

    var btnNext = document.getElementById("btnNext");
    btnNext.setAttribute("disabled", "disabled");
    btnNext.setAttribute("class", "inactive");

    this.isModelShown = false;

    this.live2DMgr.reloadFlg = true;
    this.live2DMgr.count += (isNext ? 1 : -1)

    var txtInfo = document.getElementById("txtInfo");

    var totalModelNo = this.live2DMgr.modelJsonList.length;
    var count = this.live2DMgr.count;
    if (count < 0) count = 0;
    var curModelNo = parseInt(count % totalModelNo);
    var curModelPath = this.live2DMgr.modelJsonList[curModelNo];
    txtInfo.textContent = "[" + (curModelNo + 1) + "/" + totalModelNo + "] " + curModelPath;

    this.live2DMgr.changeModel(this.gl);
}

/* ********** マウスイベント ********** */

/*
 * マウスホイールによる拡大縮小
 */
function modelScaling(scale) {
    var isMaxScale = thisRef.viewMatrix.isMaxScale();
    var isMinScale = thisRef.viewMatrix.isMinScale();

    thisRef.viewMatrix.adjustScale(0, 0, scale);

    // 画面が最大になったときのイベント
    if (!isMaxScale) {
        if (thisRef.viewMatrix.isMaxScale()) {
            thisRef.live2DMgr.maxScaleEvent();
        }
    }
    // 画面が最小になったときのイベント
    if (!isMinScale) {
        if (thisRef.viewMatrix.isMinScale()) {
            thisRef.live2DMgr.minScaleEvent();
        }
    }
}


/*
 * クリックされた方向を向く
 * タップされた場所に応じてモーションを再生
 */
function modelTurnHead(event) {
    thisRef.drag = true;

    var rect = event.target.getBoundingClientRect();

    var sx = transformScreenX(event.clientX - rect.left);
    var sy = transformScreenY(event.clientY - rect.top);
    var vx = transformViewX(event.clientX - rect.left);
    var vy = transformViewY(event.clientY - rect.top);

    if (LAppDefine.DEBUG_MOUSE_LOG)
        l2dLog("onMouseDown device( x:" + event.clientX + " y:" + event.clientY + " ) view( x:" + vx + " y:" + vy + ")");

    thisRef.lastMouseX = sx;
    thisRef.lastMouseY = sy;

    thisRef.dragMgr.setPoint(vx, vy); // その方向を向く

    // タップした場所に応じてモーションを再生
    thisRef.live2DMgr.tapEvent(vx, vy);
}


/*
 * マウスを動かした時のイベント
 */
function followPointer(event) {
    var rect = event.target.getBoundingClientRect();

    var sx = transformScreenX(event.clientX - rect.left);
    var sy = transformScreenY(event.clientY - rect.top);
    var vx = transformViewX(event.clientX - rect.left);
    var vy = transformViewY(event.clientY - rect.top);

    if (LAppDefine.DEBUG_MOUSE_LOG)
        l2dLog("onMouseMove device( x:" + event.clientX + " y:" + event.clientY + " ) view( x:" + vx + " y:" + vy + ")");

    if (thisRef.drag) {
        thisRef.lastMouseX = sx;
        thisRef.lastMouseY = sy;

        thisRef.dragMgr.setPoint(vx, vy); // その方向を向く
    }
}


/*
 * 正面を向く
 */
function lookFront() {
    if (thisRef.drag) {
        thisRef.drag = false;
    }

    thisRef.dragMgr.setPoint(0, 0);
}


function mouseEvent(e) {
    e.preventDefault();

    if (e.type == "mousewheel") {
        if (e.clientX < 0 || thisRef.canvas.clientWidth < e.clientX ||
            e.clientY < 0 || thisRef.canvas.clientHeight < e.clientY) {
            return;
        }

        if (e.wheelDelta > 0) modelScaling(1.1); // 上方向スクロール 拡大
        else modelScaling(0.9); // 下方向スクロール 縮小

    } else if (e.type == "mousedown") {

        // 右クリック以外なら処理を抜ける
        if ("button" in e && e.button != 0) return;

        modelTurnHead(e);

    } else if (e.type == "mousemove") {

        followPointer(e);

    } else if (e.type == "mouseup") {

        // 右クリック以外なら処理を抜ける
        if ("button" in e && e.button != 0) return;

        lookFront();

    } else if (e.type == "mouseout") {

        lookFront();

    } else if (e.type == "contextmenu") {

        changeModel();
    }

}

function touchEvent(e) {
    e.preventDefault();

    var touch = e.touches[0];

    if (e.type == "touchstart") {
        if (e.touches.length == 1) modelTurnHead(touch);
        // onClick(touch);

    } else if (e.type == "touchmove") {
        followPointer(touch);

        if (e.touches.length == 2) {
            var touch1 = e.touches[0];
            var touch2 = e.touches[1];

            var len = Math.pow(touch1.pageX - touch2.pageX, 2) + Math.pow(touch1.pageY - touch2.pageY, 2);
            if (thisRef.oldLen - len < 0) modelScaling(1.025); // 上方向スクロール 拡大
            else modelScaling(0.975); // 下方向スクロール 縮小

            thisRef.oldLen = len;
        }

    } else if (e.type == "touchend") {
        lookFront();
    }
}

/* ********** マトリックス操作 ********** */
function transformViewX(deviceX) {
    var screenX = this.deviceToScreen.transformX(deviceX); // 論理座標変換した座標を取得。
    return viewMatrix.invertTransformX(screenX); // 拡大、縮小、移動後の値。
}


function transformViewY(deviceY) {
    var screenY = this.deviceToScreen.transformY(deviceY); // 論理座標変換した座標を取得。
    return viewMatrix.invertTransformY(screenY); // 拡大、縮小、移動後の値。
}


function transformScreenX(deviceX) {
    return this.deviceToScreen.transformX(deviceX);
}


function transformScreenY(deviceY) {
    return this.deviceToScreen.transformY(deviceY);
}

/*
* WebGLのコンテキストを取得する
*/
function getWebGLContext() {
    var NAMES = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];

    for (var i = 0; i < NAMES.length; i++) {
        try {
            var ctx = this.canvas.getContext(NAMES[i], { premultipliedAlpha: true, preserveDrawingBuffer: true });
            if (ctx) return ctx;
        }
        catch (e) { }
    }
    return null;
};

/*
* 画面エラーを出力
*/
function l2dError(msg) {
    if (!LAppDefine.DEBUG_LOG) return;
    console.error(msg);
};