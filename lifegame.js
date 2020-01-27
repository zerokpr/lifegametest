"use strict";
var state = Object.create(null);    // M
var view = Object.create(null);     // V
var controls = Object.create(null); // C

// 読み込み時実行
window.onload = function(){
    readFile("./patterns.json", function(jsonObj, error){
        if(error){ //ファイルが読めない場合はパターンメニューを作成しない
            delete controls.pattern;
        }else{ //ファイルが読み込めたらデータをstate.patternsに格納
            state.patterns = jsonObj;
        }
        
        //body要素内にライフゲームの各パーツ（controls, view）を生成し配置
        createLifeGame(document.body, 78, 60, 780, 600);
    });
};

// ファイルを読み込む
// filename:ファイル名
// callback:読み込みの成否で挙動を変える関数
function readFile(filename, callback){
    var req = new XMLHttpRequest();
    req.onreadystatechange = function(){
        if(req.readyState == 4){
            if(req.status == 200){
                callback(req.response, false);  // success
            }else{
                callback(null, true);           // error
            }
        }
    }
    req.open("GET", filename, true);
    req.responseType = "json";
    req.send(null);
}


// ライフゲームシミュレータを生成する
// parent: シミュレータの要素を挿入する要素オブジェクト
// nx, ny: 横と縦の格子数
// width, height: canvas要素の幅と高さ
function createLifeGame(parent, nx, ny, width, height){
    // タイトル
    var title = elt("h1", {class: "title"}, "Life Game");
    
    // viewオブジェクトを生成する
    var viewpanel = view.create(nx, ny, width, height);
    
    // stateオブジェクトを生成する
    state.create(nx, ny);
    
    // controlsオブジェクトからtoolbar要素を生成する
    var toolbar = elt("div", {class: "toolbar"});
    for(name in controls) toolbar.appendChild(controls[name](state));
    
    // toolbar要素とviewpanel要素を指定した要素(parent)の子要素として挿入する
    parent.appendChild(elt("div", null, title, toolbar, viewpanel));
}



// state

// stateオブジェクトのプロパティを定義
state.create = function(nx, ny){
    // 格子サイズ
    state.nx = nx; state.ny = ny;
    
    // セルを表す2次元配列を生成し初期化
    // 値が0の時は生物がいない、1の時はいる
    state.cells = new Array(ny);
    for(var ix = 0; ix < nx; ix++){
        state.cells[ix] = new Array(ny);
        for(var iy = 0; iy < ny; iy++) state.cells[ix][iy] = 0;
    }
    
    // clickviewイベントリスナの登録:viewからのイベントでセルを変更する
    document.addEventListener("clickview", function(e){
        state.setLife(e.detail.ix, e.detail.iy, e.detail.life);
    }, false);
    
    // changeCellイベント、changeGenerationイベントオブジェクトを生成
    state.changeCellEvent = document.createEvent("HTMLEvents");
    state.changeGenerationEvent = document.createEvent("HTMLEvents");
    
    // generation(世代数)を追加し、0に設定
    state.generation = 0;
    state.tellGenerationChange(0);
    
    // アニメーションの状態を表す変数
    state.playing = false;  // アニメーションが実行中であるかどうかの論理値
    state.timer = null;     // アニメーションのタイマー
};

// セルが変更された時に呼ばれるメソッド
// セル(ix, iy)の値が変更されたとき、それを通知する独自イベントであるchangecellイベントを発生させる
// changecellイベントはviewオブジェクトが感知し、セルの表示を更新する
// 引数lifeの値が1なら生物が誕生、0なら生物が死滅
state.tellCellChange = function(ix, iy, life){
    state.changeCellEvent.initEvent("changecell", false, false);
    state.changeCellEvent.detail = {ix: ix, iy: iy, life: life};
    document.dispatchEvent(state.changeCellEvent);  
};

// 世代数が変更された時に呼ばれるメソッド
// 独自イベントであるchangegenerationイベントを発生させる
// changegenerationイベントはviewオブジェクトが感知し表示を更新する
state.tellGenerationChange = function(generation){
    state.changeGenerationEvent.initEvent("changegeneration", false, false);
    state.changeGenerationEvent.detail = {generation: generation};
    document.dispatchEvent(state.changeGenerationEvent);
};

// セル(ix, iy)の周りの生物の合計を求める
// 格子の上端と加担、左端と右端が繋がったものとして計算する
state.getSumAround = function(ix, iy){
    var dx = [0, 1, 1, 1, 0,-1,-1,-1];
    var dy = [1, 1, 0,-1,-1,-1, 0, 1];
    for(var k = 0,sum = 0; k < dx.length; k++){
        if(state.cells[(ix+dx[k]+state.nx)%state.nx][(iy+dy[k]+state.ny)%state.ny]){
            sum++;
        }
    }
    return sum;
};

//次の世代に生物の状態をアップデートする
//セルが変更されたとき、tellCellChangeメソッドでchangecellイベントを発生させてviewオブジェクトに通知
state.update = function(){
    // 状態を変えずに全セルをスキャンし、変更するセルをchangedCell配列に求める
    var changedCell = [];
    for(var ix = 0; ix < state.nx; ix++){
        for(var iy = 0; iy < state.ny; iy++){
            var sum = state.getSumAround(ix, iy);
            if( sum <= 1 || sum >= 4){ //死滅条件
                if( state.cells[ix][iy]){
                    changedCell.push({x:ix, y:iy});
                    // セルの変更をコールバック
                    state.tellCellChange(ix, iy, 0);
                }
            }else if(sum == 3){ // 周りが三匹なら生成する
                if(!state.cells[ix][iy]){
                    changedCell.push({x:ix, y:iy});
                    // セルの変更をコールバック
                    state.tellCellChange(ix, iy, 1);
                }
            }
        }
    }
    
    // changedCell配列に格納されているセルの変更を行う
    // 変更は性質上、排他的論理和を行うことで実装できる
    for(var i = 0; i < changedCell.length; i++){
        state.cells[changedCell[i].x][changedCell[i].y] ^= 1;
    }
    // 世代数を一つ増やし、それを通知する
    state.tellGenerationChange(state.generation++);
};

// セルの状態を設定するメソッド
// ix,iy:　 セルの座標
// life:    0で死滅、1で誕生、2で生死反転
state.setLife = function(ix, iy, life){
    if(life == 2){  // 生死を反転させる場合
        state.cells[ix][iy] ^= 1;
        state.tellCellChange(ix, iy, state.cells[ix][iy]);
    }else{          // lifeで上書き
        if(state.cells[ix][iy] != life){
            state.cells[ix][iy] = life;
            state.tellCellChange(ix, iy, life);
        }
    }
};

// 全セルをクリア
state.clearAllCell = function(){
    // 全セルの値を0にする
    for(var ix = 0; ix < state.nx; ix++){
        for(var iy = 0; iy < state.ny; iy++){
            state.setLife(ix, iy, 0);
        }
    } 
    // 世代数を0としコールバックする
    state.tellGenerationChange(state.generation = 0);
};


// view

// viewオブジェクトのプロパティを定義する
// nx, ny: セルの格子数
// width, height: canvasのサイズ
view.create = function(nx, ny, width, height){
    // レイヤーを表すcanvas要素を作成
    view.layer = [];
    
    // 生物表示用
    view.layer[0] = elt("canvas", {id: "rayer0", width: width, height: height});
    
    // 格子線表示用
    view.layer[1] = elt("canvas", {id: "rayer1", width: width, height: height});
    
    // 格子のサイズ、セルのサイズ、生物マーカーの半径を設定
    view.nx = nx;
    view.ny = ny;
    view.cellWidth = view.layer[0].width/nx; // セルの幅
    view.cellHeight = view.layer[0].height/ny; // セルの高さ
    
    // 生物を表す円の半径
    view.markRadius = (Math.min(view.cellWidth, view.cellHeight)/2.5 + 0.5) | 0;
    
    // canvasコンテキストを取得
    if(view.ctx) delete view.ctx;
    view.ctx = [];
    for(var i = 0; i < view.layer.length; i++){
        view.ctx.push(view.layer[i].getContext("2d"));
    }

    // 描画パラメータの初期設定
    view.backColor = "forestgreen"; // 背景色
    view.markColor = "white"; // 生物の色
    view.strokeStyle = "black"; // 格子線の色
    view.lineWidth = 0.2; // 格子線の幅
    
    // 格子を描画する
    view.drawLattice();
    
    // 世代数を表示する要素を作成
    view.generation = elt("span", {id: " generation"});
    view.statuspanel = elt("div", {class: "status"}, "世代数:", view.generation);
    
    // clickviewイベント用イベントオブジェクトを生成
    view.clickEvent = document.createEvent("HTMLEvents");
    // layer[1]をクリックしたときのイベントリスナを登録
    view.layer[1].addEventListener("click", function(e){
        var ix = Math.floor(e.offsetX/view.cellWidth);
        var iy = Math.floor(e.offsetY/view.cellHeight);
        // viewの(ix, iy)がクリックされたことをclickviewイベントで通知
        view.clickEvent.initEvent("clickview", false, false);
        view.clickEvent.detail = {ix: ix, iy: iy, life: 2};
        document.dispatchEvent(view.clickEvent);
    }, false);

    // changeCellイベントリスナの登録: stateからのイベントでセルを再描画する
    document.addEventListener("changecell", function(e){
        view.drawCell(e.detail.ix, e.detail.iy, e.detail.life);
    }, false);

    // changeGenerationイベントリスナの登録: stateからのイベントで世代数を更新する
    document.addEventListener("changegeneration", function(e){
        view.showGeneration(e.detail.generation);
    }, false);

    // viewpanel要素オブジェクトを返す
    return elt(
        "div", {class: "viewpanel"}, view.layer[0], view.layer[1], view.statuspanel
    );
};

// viewLattice
// 格子点を描画する
view.drawLattice = function(){
    // 各レイヤーのCanvasをリセット
    for(var i = 0; i < view.layer.length; i++){
        view.layer[i].width = view.layer[i].width;
    }
    // レイヤー1に格子を描く。格子はnxが150未満の時のみ描く
    if(view.nx<150){
        var c = view.ctx[1];
        c.lineWidth = view.lineWidth;
        c.strokeStyle = view.strokeStyle;
        for(var ix = 0; ix <= view.nx; ix++){ // 縦線
            c.beginPath();
            c.moveTo(ix*view.cellWidth,0);
            c.lineTo(ix*view.cellWidth, view.nx*view.cellHeight);
            c.stroke();
        }
        for(var iy = 0; iy <= view.ny; iy++){ // 横線
            c.beginPath();
            c.moveTo(0, iy*view.cellHeight);
            c.lineTo(view.nx*view.cellWidth, iy*view.cellHeight);
            c.stroke();
        }
    }

    // レイヤー0を背景色で塗りつぶす
    c = view.ctx[0];
    c.fillStyle = view.backColor;
    c.fillRect(0, 0, view.layer[0].width, view.layer[0].height);
};

// viewdrawCell
// セルに生物を描画する
// ix, iy: 描画するセルの座標
// life: 
view.drawCell = function(ix, iy, life){
    var c = view.ctx[0]; // 生物はlayer[0]に描画する
    c.beginPath();
    if(life){ // 生物が存在する場合
        var x = (ix + 0.5)*view.cellWidth;
        var y = (iy + 0.5)*view.cellHeight;
        var r = view.markRadius;
        c.fillStyle = view.markColor;
        c.arc(x, y, r, 0, Math.PI*2, true);
        c.fill();
    }else{ // 生物が存在しない場合
        var x = ix*view.cellWidth;
        var y = iy*view.cellHeight;
        c.fillStyle = view.backColor;
        c.fillRect(x, y, view.cellWidth, view.cellHeight);
    }
};

// showGeneration
// 世代数を表示する
// generation: 表示する世代数の値
view.showGeneration = function(generation){
    view.generation.innerHTML = generation;
};


// controls
// メソッドは全てstateオブジェクトを引数に持つ

// 連続再生ボタン
controls.play = function(state){
    if(!state.timeInterval) state.timeInterval = 300; // time.intervalが未定義なら初期化
    var input = elt("input", { type: "button", value: "連続再生" });
    input.addEventListener("click",function(e){
        if(!state.playing){
            state.timer = setInterval(state.update, state.timeInterval);
            state.playing = true;
        }
    });
    return input;
};

// 再生速度選択メニュー
controls.changeTimeInterval = function(state){
    var select = elt("select");
    var options = [
        { name: "超高速(20ms)", value: 20 },
        { name: "高速(100ms)", value: 100 },
        { name: "標準(300ms)", value: 300 },
        { name: "低速(600ms)", value: 600 }
    ];
    for(var i=0; i < options.length; i++){
        var option = elt("option", null, options[i].name);
        select.appendChild(option);
    }
    select.selectedIndex = 2;
    select.addEventListener("change", function(e){
        state.timeInterval = options[select.selectedIndex].value;
        if( state.playing ){
            clearInterval(state.timer);
            state.timer = setInterval(state.update, state.timeInterval);
        }
    });
    return select;
};

// 停止ボタン
// ボタンをクリックするとアニメーション停止
controls.stop = function(state){
    var input = elt("input", { type: "button", value: "停止"});
    input.addEventListener("click", function(e){
        if( state.playing ){
            clearInterval(state.timer);
            state.playing = false;
        }
    });
    return input;
};

// 次へボタン
// ボタンをクリックすると世代を一つだけアップデート
controls.step = function(state){
    var input = elt("input", {type: "button", value: "次へ"});
    input.addEventListener("click", function(e){
        clearInterval(state.timer); state.playing = false;
        state.update();
    });
    return input;
};

// 「パターンを選択」メニューのメソッド
// メニューからパターンを選択すると、そのパターンがstate.setLifeメソッドでstate.cellsにセットされる
controls.pattern = function(state){
    var select = elt("select");
    select.appendChild(elt("option", null, "パターンを選択"));
    for(var i=0;i<state.patterns.length;i++){
        select.appendChild(elt("option", null, state.patterns[i].name));
    }
    select.selectedIndex = 0;
    select.addEventListener("change", function(e){
        clearInterval(state.timer); state.playing = false; // モードが変わったらアニメーション停止
        if(select.selectedIndex != 0){
            placePattern(state.patterns[select.selectedIndex-1]); // "パターンを選択"ボタンの分一つずらす
        }
        //select.selectedIndex = 0;
    });
    return select;
    function placePattern(pattern){
        var array = pattern.points;
        // x, yの最小値と最大値を求める
        var max = [0, 0];
        var min = [state.nx-1, state.ny-1];
        for(var i=0; i<array.length; i++){
            for(var d=0; d<2; d++){
                if(array[i][d] > max[d]) max[d] = array[i][d];
                if(array[i][d] < min[d]) min[d] = array[i][d];
            }
        }
        // 全セルをクリア
        state.clearAllCell();
        // Canvasの中心にパターンを配置する
        for(var i = 0; i < array.length; i++){
            var ix = array[i][0] + Math.floor((state.nx - min[0] - max[0])/2);
            var iy = array[i][1] + Math.floor((state.ny - min[1] - max[1])/2);
            state.setLife(ix, iy, 1);
        }
        state.tellGenerationChange(state.generation = 0);
    }
};

// 全消去ボタン
// ボタンを押すと、すべてがリセットされ、全生物が消去される
controls.clear = function(state){
    var input = elt("input", { type: "button", value: "全消去" });
    input.addEventListener("click", function(e){
        clearInterval(state.timer); state.playing = false;
        state.clearAllCell();
    });
    return input;
};
