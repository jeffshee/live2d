const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nativeTheme = require("electron");
const { timeStamp, time } = require("console");

nativeTheme.themeSource = "dark";

// Parameters
const datasetRoot = "dataset"; // Root of dataset directory
const blacklistPath = path.join(datasetRoot, "blacklist.txt"); // Blacklist path
const outputRoot = "output"; // Root of output directory
const baseResolution = 1024;
const ignoreOriginalJson = true; // Ignore the original JSON file and use the self-generated one instead

var thisRef = this;

var getPartIDs = function (modelImpl) {
    let partIDs = [];
    partsDataList = modelImpl._$Xr();
    partsDataList.forEach((element) => {
        partIDs.push(element._$NL.id);
    });
    return partIDs;
};

var getParamIDs = function (modelImpl) {
    let paramIDs = [];
    paramDefSet = modelImpl._$E2()._$4S;
    paramDefSet.forEach((element) => {
        paramIDs.push(element._$wL.id);
    });
    return paramIDs;
};

// JavaScriptで発生したエラーを取得
window.onerror = function (msg, url, line, col, error) {
    var errmsg = "file:" + url + "<br>line:" + line + " " + msg;
    l2dError(errmsg);
};

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
    this.oldLen = 0; // 二本指タップした時の二点間の距離

    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.isModelShown = false;

    this.isPlay = true;
    this.isLookRandom = false;
    this.frameCount = 0;

    // Shortcut keys
    document.addEventListener("keydown", function (e) {
        var keyCode = e.keyCode;
        if (keyCode == 90) {
            // z key
            viewer.changeModel(-1);
        } else if (keyCode == 88) {
            // x key
            viewer.changeModel(1);
        } else if (keyCode == 32) {
            // space key
            viewer.flagBlacklist();
        }
    });

    this.blacklist = [];
    if (fs.existsSync(blacklistPath)) {
        this.blacklist = fs.readFileSync(blacklistPath).toString().split("\n");
        // Append datasetRoot to the paths
        this.blacklist.forEach((item, index) => {
            this.blacklist[index] = path.join(datasetRoot, item);
        });
    }

    // モデル描画用canvasの初期化
    viewer.initL2dCanvas("glcanvas");

    // モデル用マトリクスの初期化と描画の開始
    viewer.init();
}

viewer.goto = function () {
    live2DMgr.count = parseInt(document.getElementById("editGoto").value) - 1;
    viewer.changeModel(0);
};

viewer.save = function (filepath = path.join(outputRoot, "image.png")) {
    // Save canvas to png file
    var img = canvas.toDataURL();
    var data = img.replace(/^data:image\/\w+;base64,/, "");
    var buf = Buffer.from(data, "base64");
    fs.writeFileSync(filepath, buf);
};

viewer.saveLayer = function (dir = path.join(outputRoot, "layer")) {
    // Create dir
    fs.mkdirSync(dir, { recursive: true });

    // Keep previous playing state, and set to pause to stop calling draw()
    var prevIsPlay = isPlay;
    isPlay = false;

    // Remember to update the model before calling getElementList()
    var model = live2DMgr.getModel(0);
    model.update(frameCount);
    var elementList = model.live2DModel.getElementList();

    // Save images for each element
    MatrixStack.reset();
    MatrixStack.loadIdentity();
    MatrixStack.multMatrix(projMatrix.getArray());
    MatrixStack.multMatrix(viewMatrix.getArray());
    MatrixStack.push();

    // Draw an image with all elements
    viewer.save(path.join(dir, "all.png"));

    elementList.forEach((item, index) => {
        var element = item.element;
        var partID = item.partID;
        var order = ("000" + index).slice(-4);
        gl.clear(gl.COLOR_BUFFER_BIT);
        model.drawElement(gl, element);
        // Separate directory for each partID
        if (!fs.existsSync(path.join(dir, partID))) {
            fs.mkdirSync(path.join(dir, partID));
        }
        viewer.save(path.join(dir, partID, order + "_" + partID + ".png"));
    });

    MatrixStack.pop();

    isPlay = prevIsPlay;
};

viewer.togglePlayPause = function () {
    isPlay = !isPlay;
    btnPlayPause.textContent = isPlay ? "Pause" : "Play";
};

viewer.secret = function () {
    // Print model stat
    var live2DModel = live2DMgr.getModel(0).live2DModel;
    var modelImpl = live2DModel.getModelImpl();

    console.log("getPartIDs", getPartIDs(modelImpl));
    console.log("getParamIDs", getParamIDs(modelImpl));

    parts = modelImpl._$F2;
    partsCount = parts.length;
    var elementCount = 0;
    parts.forEach((element) => {
        console.log(element.getDrawData());
        elementCount += element.getDrawData().length;
    });
    console.log("partCount", partsCount);
    console.log("elementCount", elementCount);
};

// TODO
viewer.batch = function () {
    const delay = 1000;
    var count = live2DMgr.getCount();
    op = function () {
        if (count < live2DMgr.modelJsonList.length) {
            console.log(
                "Batch operation",
                document.getElementById("txtInfo").textContent
            );
            var no = ("000" + (count + 1)).slice(-4);
            var dir = path.join(outputRoot, no);
            fs.mkdirSync(dir, { recursive: true });
            viewer.saveLayer(dir);
            viewer.changeModel(1);
            count++;
            // Make a delay here
            setTimeout(op, delay);
        }
    };
    // Start op
    op();
};

viewer.resize = function () {
    const baseHeight = 1024;

    live2DModel = live2DMgr.getModel(0).live2DModel;
    if (live2DModel == null) return;

    var modelWidth = live2DModel.getCanvasWidth();
    var modelHeight = live2DModel.getCanvasHeight();
    if (modelHeight > modelWidth) {
        // Portrait
        canvas.width = baseResolution;
        canvas.height = (modelHeight / modelWidth) * baseResolution;
    } else {
        canvas.width = (modelWidth / modelHeight) * baseResolution;
        canvas.height = baseResolution;
    }

    // canvas.width = live2DModel.getCanvasWidth() / live2DModel.getCanvasHeight() * baseHeight;
    // canvas.height = baseHeight;

    // ビュー行列
    var ratio = canvas.height / canvas.width;
    var left = LAppDefine.VIEW_LOGICAL_LEFT;
    var right = LAppDefine.VIEW_LOGICAL_RIGHT;
    var bottom = -ratio;
    var top = ratio;

    viewMatrix = new L2DViewMatrix();

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    viewMatrix.setScreenRect(left, right, bottom, top);

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    viewMatrix.setMaxScreenRect(
        LAppDefine.VIEW_LOGICAL_MAX_LEFT,
        LAppDefine.VIEW_LOGICAL_MAX_RIGHT,
        LAppDefine.VIEW_LOGICAL_MAX_BOTTOM,
        LAppDefine.VIEW_LOGICAL_MAX_TOP
    );

    viewMatrix.setMaxScale(LAppDefine.VIEW_MAX_SCALE);
    viewMatrix.setMinScale(LAppDefine.VIEW_MIN_SCALE);

    projMatrix = new L2DMatrix44();
    projMatrix.multScale(1, canvas.width / canvas.height);

    // マウス用スクリーン変換行列
    deviceToScreen = new L2DMatrix44();
    deviceToScreen.multTranslate(-canvas.width / 2.0, -canvas.height / 2.0);
    deviceToScreen.multScale(2 / canvas.width, -2 / canvas.width);

    gl.viewport(0, 0, canvas.width, canvas.height);
};

viewer.initL2dCanvas = function (canvasId) {
    // canvasオブジェクトを取得
    canvas = document.getElementById(canvasId);

    // イベントの登録
    if (canvas.addEventListener) {
        canvas.addEventListener("mousewheel", mouseEvent, false);
        canvas.addEventListener("click", mouseEvent, false);

        canvas.addEventListener("mousedown", mouseEvent, false);
        canvas.addEventListener("mousemove", mouseEvent, false);

        canvas.addEventListener("mouseup", mouseEvent, false);
        canvas.addEventListener("mouseout", mouseEvent, false);
        canvas.addEventListener("contextmenu", mouseEvent, false);

        // タッチイベントに対応
        canvas.addEventListener("touchstart", touchEvent, false);
        canvas.addEventListener("touchend", touchEvent, false);
        canvas.addEventListener("touchmove", touchEvent, false);
    }
};

viewer.init = function () {
    // Initialize UI components
    btnPrev = document.getElementById("btnPrev");
    btnNext = document.getElementById("btnNext");
    btnPrev.addEventListener("click", function (e) {
        viewer.changeModel(-1);
    });
    btnNext.addEventListener("click", function (e) {
        viewer.changeModel(1);
    });

    btnGoto = document.getElementById("btnGoto");
    btnGoto.addEventListener("click", function (e) {
        viewer.goto();
    });

    btnPlayPause = document.getElementById("btnPlayPause");
    btnPlayPause.addEventListener("click", function (e) {
        viewer.togglePlayPause();
    });
    btnPlayPause.textContent = isPlay ? "Pause" : "Play";

    btnSave = document.getElementById("btnSave");
    btnSave.addEventListener("click", function (e) {
        viewer.save();
    });

    btnSaveLayer = document.getElementById("btnSaveLayer");
    btnSaveLayer.addEventListener("click", function (e) {
        viewer.saveLayer();
    });

    btnSecret = document.getElementById("btnSecret");
    btnSecret.addEventListener("click", function (e) {
        viewer.secret();
    });

    btnBatch = document.getElementById("btnBatch");
    btnBatch.addEventListener("click", function (e) {
        viewer.batch();
    });

    btnResize = document.getElementById("btnResize");
    btnResize.addEventListener("click", function (e) {
        viewer.resize();
    });

    btnLookRandom = document.getElementById("btnLookRandom");
    btnLookRandom.addEventListener("click", function (e) {
        isLookRandom = !isLookRandom;
    });

    // Load all models
    let filelist = [];
    walkdir(datasetRoot, function (filepath) {
        filelist.push(filepath);
    });
    live2DMgr.setModelJsonList(loadModel(filelist));

    // 3Dバッファの初期化
    var width = canvas.width;
    var height = canvas.height;

    dragMgr = new L2DTargetPoint();

    // ビュー行列
    var ratio = height / width;
    var left = LAppDefine.VIEW_LOGICAL_LEFT;
    var right = LAppDefine.VIEW_LOGICAL_RIGHT;
    var bottom = -ratio;
    var top = ratio;

    viewMatrix = new L2DViewMatrix();

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    viewMatrix.setScreenRect(left, right, bottom, top);

    // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
    viewMatrix.setMaxScreenRect(
        LAppDefine.VIEW_LOGICAL_MAX_LEFT,
        LAppDefine.VIEW_LOGICAL_MAX_RIGHT,
        LAppDefine.VIEW_LOGICAL_MAX_BOTTOM,
        LAppDefine.VIEW_LOGICAL_MAX_TOP
    );

    viewMatrix.setMaxScale(LAppDefine.VIEW_MAX_SCALE);
    viewMatrix.setMinScale(LAppDefine.VIEW_MIN_SCALE);

    projMatrix = new L2DMatrix44();
    projMatrix.multScale(1, width / height);

    // マウス用スクリーン変換行列
    deviceToScreen = new L2DMatrix44();
    deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
    deviceToScreen.multScale(2 / width, -2 / width);

    // WebGLのコンテキストを取得する
    gl = getWebGLContext();
    if (!gl) {
        l2dError("Failed to create WebGL context.");
        return;
    }
    // OpenGLのコンテキストをセット
    Live2D.setGL(gl);

    // 描画エリアを白でクリア
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // Call changeModel once to initialize
    viewer.changeModel(0);

    viewer.startDraw();
};

viewer.startDraw = function () {
    if (!isDrawStart) {
        isDrawStart = true;
        (function tick() {
            if (isPlay) {
                viewer.draw(); // 1回分描画
            }

            var requestAnimationFrame =
                window.requestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.msRequestAnimationFrame;

            // 一定時間後に自身を呼び出す
            requestAnimationFrame(tick, canvas);
        })();
    }
};

viewer.draw = function () {
    // l2dLog("--> draw()");
    // viewer.resize();

    MatrixStack.reset();
    MatrixStack.loadIdentity();

    if (frameCount % 30 == 0) {
        lookRandom();
    }

    dragMgr.update(); // ドラッグ用パラメータの更新

    // Note: face direction, top-left (-1,1), top-right (1,1), bottom-left (-1,-1), bottom-right (1,-1)
    // dragMgr.setPoint(1, 1); // その方向を向く

    live2DMgr.setDrag(dragMgr.getX(), dragMgr.getY());

    // Canvasをクリアする
    gl.clear(gl.COLOR_BUFFER_BIT);

    MatrixStack.multMatrix(projMatrix.getArray());
    MatrixStack.multMatrix(viewMatrix.getArray());
    MatrixStack.push();

    for (var i = 0; i < live2DMgr.numModels(); i++) {
        var model = live2DMgr.getModel(i);

        if (model == null) return;

        if (model.initialized && !model.updating) {
            model.update(frameCount);
            model.draw(gl);

            if (!isModelShown && i == live2DMgr.numModels() - 1) {
                isModelShown = !isModelShown;
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

    if (isPlay) {
        frameCount++;
    }
};

viewer.changeModel = function (inc = 1) {
    btnPrev = document.getElementById("btnPrev");
    btnPrev.setAttribute("disabled", "disabled");
    btnPrev.setAttribute("class", "inactive");

    btnNext = document.getElementById("btnNext");
    btnNext.setAttribute("disabled", "disabled");
    btnNext.setAttribute("class", "inactive");

    isModelShown = false;

    live2DMgr.reloadFlg = true;
    live2DMgr.count += inc;

    txtInfo = document.getElementById("txtInfo");

    var count = live2DMgr.getCount();
    var curModelPath = live2DMgr.modelJsonList[count];
    txtInfo.textContent =
        "[" +
        (count + 1) +
        "/" +
        live2DMgr.modelJsonList.length +
        "] " +
        curModelPath +
        " ,MD5: " +
        md5file(curModelPath);

    live2DMgr.changeModel(gl, viewer.resize);
};

viewer.flagBlacklist = function () {
    var count = live2DMgr.getCount();
    var curModelPath = live2DMgr.modelJsonList[count];
    relativeCurModelPath = curModelPath.slice(datasetRoot.length + 1); // Include the '/'
    fs.appendFileSync(blacklistPath, relativeCurModelPath + "\n");
    console.log("flagBlacklist", "Flagged " + relativeCurModelPath);
};

function prettyPrintEveryJson() {
    walkdir(datasetRoot, (file) => {
        if (file.endsWith(".json")) {
            j = fs.readFileSync(file).toString();
            try {
                fs.writeFileSync(file, JSON.stringify(JSON.parse(j), null, 3));
            } catch (error) {
                console.error("JSON Parse Error", file);
            }
        }
    });
}

function md5file(filePath) {
    const target = fs.readFileSync(filePath);
    const md5hash = crypto.createHash("md5");
    md5hash.update(target);
    return md5hash.digest("hex");
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
    });
    modelJsonList = [...new Set(modelJsonList)];
    // Filter out the blacklisted models
    modelJsonList = modelJsonList.filter(function (e) {
        return this.indexOf(e) < 0;
    }, this.blacklist);
    console.log("loadModel", modelJsonList.length + " model loaded");
    return modelJsonList;
}

function getJson(mocPath) {
    pardir = path.dirname(mocPath);
    let textures = [];
    let motions = [];
    let physics = [];
    let modelJson = [];
    walkdir(pardir, function (filepath) {
        if (filepath.endsWith(".png")) {
            textures.push(filepath.replace(pardir + "/", ""));
        } else if (filepath.endsWith(".mtn")) {
            motions.push(filepath.replace(pardir + "/", ""));
        } else if (
            filepath.endsWith("physics") ||
            filepath.endsWith("physics.json")
        ) {
            physics.push(filepath.replace(pardir + "/", ""));
        } else if (filepath.endsWith("model.json")) {
            if (!ignoreOriginalJson) {
                modelJson.push(filepath);
            }
        }
    });
    // Generate a JSON file based on all the resources we can find
    if (modelJson.length == 0) {
        if (textures.length == 0) {
            console.warn("getJson", "0 texture found! .moc path: " + mocPath);
        }
        if (physics.length > 1) {
            console.warn(
                "getJson",
                "more than 1 physics found! .moc path: " + mocPath
            );
        }
        textures.sort();
        motions.sort();
        var model = {};
        model["version"] = "Sample 1.0.0";
        model["model"] = mocPath.replace(pardir + "/", "");
        model["textures"] = textures;
        if (motions.length > 0) {
            model["motions"] = { idle: [] };
            motions.forEach((motion) => {
                // Set all motion as idle motion, check commented out code for previous method
                model["motions"]["idle"].push({ file: motion });
                // var basename = path.basename(motion, ".mtn");
                // if (basename.includes("idle")) {
                //     model["motions"]["idle"].push({ "file": motion });
                // } else {
                //     model["motions"][basename] = { "file": motion };
                // }
            });
        }
        json = JSON.stringify(model, null, 3);
        generatedJsonPath = path.join(pardir, "generated.model.json");
        modelJson.push(generatedJsonPath);
        fs.writeFileSync(generatedJsonPath, json);
    }
    return modelJson;
}

function walkdir(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        var filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walkdir(filepath, callback);
        } else if (stats.isFile()) {
            callback(filepath);
        }
    });
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
        l2dLog(
            "onMouseDown device( x:" +
                event.clientX +
                " y:" +
                event.clientY +
                " ) view( x:" +
                vx +
                " y:" +
                vy +
                ")"
        );

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
        l2dLog(
            "onMouseMove device( x:" +
                event.clientX +
                " y:" +
                event.clientY +
                " ) view( x:" +
                vx +
                " y:" +
                vy +
                ")"
        );

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

function lookRandom() {
    if (thisRef.isLookRandom) {
        sx = Math.random() * 2.0 - 1.0;
        sy = Math.random() * 2.0 - 1.0;
        thisRef.dragMgr.setPoint(sx, sy);
        console.log("lookRandom", sx, sy);
    }
}

function mouseEvent(e) {
    e.preventDefault();

    if (e.type == "mousewheel") {
        if (
            e.clientX < 0 ||
            thisRef.canvas.clientWidth < e.clientX ||
            e.clientY < 0 ||
            thisRef.canvas.clientHeight < e.clientY
        ) {
            return;
        }

        if (e.wheelDelta > 0) modelScaling(1.1);
        // 上方向スクロール 拡大
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

            var len =
                Math.pow(touch1.pageX - touch2.pageX, 2) +
                Math.pow(touch1.pageY - touch2.pageY, 2);
            if (thisRef.oldLen - len < 0) modelScaling(1.025);
            // 上方向スクロール 拡大
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
            var ctx = this.canvas.getContext(NAMES[i], {
                premultipliedAlpha: true,
                preserveDrawingBuffer: true,
            });
            if (ctx) return ctx;
        } catch (e) {}
    }
    return null;
}

/*
 * 画面エラーを出力
 */
function l2dError(msg) {
    if (!LAppDefine.DEBUG_LOG) return;
    console.error(msg);
}
