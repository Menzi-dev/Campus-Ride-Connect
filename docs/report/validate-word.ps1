$ErrorActionPreference = 'Stop'
$reportDirectory = $PSScriptRoot
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    if ($word.Documents.Count -ne 0) {
        throw 'Word instance already has documents; leaving them untouched.'
    }
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $inputPath = Join-Path $reportDirectory 'CampusConnect-Final-Report.docx'
    $outputPath = Join-Path $reportDirectory 'CampusConnect-Final-Report-Word-Preview.pdf'
    $document = $word.Documents.Open($inputPath, $false, $true, $false)
    $document.Repaginate()
    $pageCount = $document.ComputeStatistics(2)
    $document.ExportAsFixedFormat($outputPath, 17)
    Write-Output "WORD_PAGES=$pageCount"
    if ($pageCount -ne 20) { throw "Expected 20 Word pages; found $pageCount" }
} finally {
    if ($null -ne $document) { $document.Close(0) }
    if ($null -ne $word -and $word.Documents.Count -eq 0) { $word.Quit() }
}
