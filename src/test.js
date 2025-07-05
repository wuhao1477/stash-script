console.log("这是一个测试脚本，测试 stash的 js 脚本是怎么样运行的")
if($request){
    console.log("有$request方法")
    console.log($request)
}
if($response){
    console.log("有$response变量")
    console.log($response)
}

if($done){
    console.log("有$done方法")
    $done()
}