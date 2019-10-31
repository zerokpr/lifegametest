/*
関数名：elt
概要：与えられた名前（name）、属性（attributes）（オブジェクト）を持つ子ノードを作成して返す
引数name：要素に付ける名前
引数attributes：属性をプロパティ名、属性値をプロパティの値とするオブジェクト
第3引数以降：子ノードオブジェクトのリスト
*/
function elt(name, attributes){
    var node = document.createElement(name);
    if(attributes){
        for(var attr in attributes){
            if(attributes.hasOwnProperty(attr)){
                node.setAttribute(attr,attributes[attr]);
            }
        }
    }
    for(var i = 2; i < arguments.length; i++){
        var child = arguments[i];
        if(typeof child == "string"){
            child = document.createTextNode(child); //要素を作成
        }
        node.appendChild(child); //作成した要素をDOMツリーに挿入
    }
    return node;
}