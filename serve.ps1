$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8091/')
$listener.Start()
Write-Host 'Server started at http://localhost:8091'
while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $url = $ctx.Request.Url.LocalPath
    if ($url -eq '/') { $url = '/index.html' }
    $path = Join-Path 'D:\project\gaokao-app' $url.TrimStart('/')
    if (Test-Path $path -PathType Leaf) {
        $buf = [System.IO.File]::ReadAllBytes($path)
        $ctx.Response.ContentLength64 = $buf.Length
        $ctx.Response.OutputStream.Write($buf, 0, $buf.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
}