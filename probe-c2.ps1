$c2Host   = "rs.bitken.cloud"
$port     = 4444
$timeoutMs = 5000
$listenSeconds = 10

Write-Host "Resolving ${c2Host}..."
try {
    [System.Net.Dns]::GetHostEntry($c2Host) | Out-Null
    Write-Host "DNS OK"
} catch {
    Write-Host "DNS lookup failed: $($_.Exception.Message)"
    exit 1
}

$client = New-Object System.Net.Sockets.TcpClient
$client.SendTimeout    = $timeoutMs
$client.ReceiveTimeout = $timeoutMs

try {
    Write-Host "Connecting to ${c2Host}:${port} ..."
    $client.Connect($c2Host, $port)
    Write-Host "Connected. Local endpoint: $($client.Client.LocalEndPoint)"

    $stream  = $client.GetStream()
    $writer  = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::UTF8)
    $writer.AutoFlush = $true
    $reader  = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)

    $probe = '{"type":"ping"}'
    Write-Host "Sending probe: $probe"
    $writer.WriteLine($probe)

    $deadline = [DateTime]::UtcNow.AddSeconds($listenSeconds)
    $buffer = New-Object System.Collections.Generic.List[string]

    while ([DateTime]::UtcNow -lt $deadline) {
        if ($stream.DataAvailable) {
            $line = $reader.ReadLine()
            if ($line) {
                Write-Host ("[RECV] " + $line)
                $buffer.Add($line)
            }
        } else {
            Start-Sleep -Milliseconds 200
        }
    }

    if ($buffer.Count -eq 0) {
        Write-Host "No data received within $listenSeconds seconds."
    } else {
        Write-Host "Received $($buffer.Count) line(s)."
    }
} catch {
    Write-Host "Connection failed: $($_.Exception.Message)"
} finally {
    $client.Close()
    Write-Host "Socket closed."
}
