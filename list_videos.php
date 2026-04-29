<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$videoDir = __DIR__ . '/videos/';

// ─── Create videos dir if missing ────────────────────────────────────────────
if (!is_dir($videoDir)) {
    if (!mkdir($videoDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Não foi possível criar o diretório videos/']);
        exit;
    }
}

// ─── Supported formats ────────────────────────────────────────────────────────
$allowedExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ogv', 'flv', 'wmv', '3gp'];

$videos = [];
$series = [];

$entries = scandir($videoDir);
if ($entries === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Não foi possível ler o diretório videos/']);
    exit;
}

$entries = array_diff($entries, ['.', '..', '.DS_Store', 'Thumbs.db', '.gitkeep']);

foreach ($entries as $entry) {
    $entryPath = $videoDir . $entry;

    // ── SUBPASTA → série ──────────────────────────────────────────────────────
    if (is_dir($entryPath)) {
        $episodes        = [];
        $seriesSizeBytes = 0;

        $epFiles = scandir($entryPath);
        if (!$epFiles) continue;
        $epFiles = array_diff($epFiles, ['.', '..', '.DS_Store', 'Thumbs.db']);

        foreach ($epFiles as $epFile) {
            $ext = strtolower(pathinfo($epFile, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExtensions)) continue;

            $epPath = $entryPath . '/' . $epFile;
            if (!is_readable($epPath)) continue;

            $fileSize = filesize($epPath);
            if ($fileSize === false || $fileSize === 0) continue;

            $seriesSizeBytes += $fileSize;
            $parsed   = parseEpisodeCode($epFile);
            $epTitle  = cleanTitle(pathinfo($epFile, PATHINFO_FILENAME));
            $duration = getVideoDuration($epPath, $fileSize);

            $episodes[] = [
                'id'           => md5($epPath . filemtime($epPath)),
                'title'        => $epTitle,
                'filename'     => $epFile,
                'file'         => 'videos/' . rawurlencode($entry) . '/' . rawurlencode($epFile),
                'size'         => formatSize($fileSize),
                'sizeBytes'    => (int) $fileSize,
                'duration'     => $duration,
                'extension'    => $ext,
                'lastModified' => (int) filemtime($epPath),
                'season'       => $parsed['season'],
                'episode'      => $parsed['episode'],
                'episodeCode'  => $parsed['code'],
            ];
        }

        if (empty($episodes)) continue;

        // Sort: season then episode
        usort($episodes, function($a, $b) {
            if ($a['season'] !== $b['season']) return $a['season'] - $b['season'];
            return $a['episode'] - $b['episode'];
        });

        // Group into seasons
        $seasons = [];
        foreach ($episodes as $ep) {
            $s = $ep['season'];
            if (!isset($seasons[$s])) {
                $seasons[$s] = ['season' => $s, 'episodes' => []];
            }
            $seasons[$s]['episodes'][] = $ep;
        }
        ksort($seasons);

        $series[] = [
            'id'           => md5($entryPath . $entry),
            'type'         => 'series',
            'title'        => $entry,
            'folder'       => $entry,
            'episodeCount' => count($episodes),
            'seasonCount'  => count($seasons),
            'seasons'      => array_values($seasons),
            'size'         => formatSize($seriesSizeBytes),
            'sizeBytes'    => $seriesSizeBytes,
            'lastModified' => max(array_column($episodes, 'lastModified')),
            'sampleFile'   => $episodes[0]['file'],
        ];

        continue;
    }

    // ── ARQUIVO SOLTO → vídeo normal ─────────────────────────────────────────
    $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExtensions)) continue;
    if (!is_readable($entryPath)) continue;

    $fileSize = filesize($entryPath);
    if ($fileSize === false || $fileSize === 0) continue;

    $title    = cleanTitle(pathinfo($entry, PATHINFO_FILENAME));
    $duration = getVideoDuration($entryPath, $fileSize);

    $videos[] = [
        'id'           => md5($entryPath . filemtime($entryPath)),
        'type'         => 'video',
        'title'        => $title ?: $entry,
        'filename'     => $entry,
        'file'         => 'videos/' . rawurlencode($entry),
        'size'         => formatSize($fileSize),
        'sizeBytes'    => (int) $fileSize,
        'duration'     => $duration,
        'extension'    => $ext,
        'lastModified' => (int) filemtime($entryPath),
    ];
}

usort($videos, fn($a, $b) => $b['lastModified'] - $a['lastModified']);
usort($series, fn($a, $b) => $b['lastModified'] - $a['lastModified']);

// Series first, then standalone videos
echo json_encode(array_merge($series, $videos), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanTitle(string $name): string {
    $name = preg_replace('/\b[Ss]\d{1,2}[Ee]\d{1,3}\b/', '', $name);
    $name = preg_replace('/\b\d{1,2}[xX]\d{1,3}\b/', '', $name);
    $name = preg_replace('/[_\-\.]+/', ' ', $name);
    $name = preg_replace('/\s+/', ' ', $name);
    $name = preg_replace('/\b(1080p|720p|480p|360p|4k|hdr|bluray|webrip|dvdrip|x264|x265|hevc|aac|mp3)\b/i', '', $name);
    $name = trim($name);
    return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
}

function parseEpisodeCode(string $filename): array {
    $base = pathinfo($filename, PATHINFO_FILENAME);

    if (preg_match('/[Ss](\d{1,2})[Ee](\d{1,3})/', $base, $m)) {
        return ['season' => (int)$m[1], 'episode' => (int)$m[2],
                'code' => 'S'.str_pad($m[1],2,'0',STR_PAD_LEFT).'E'.str_pad($m[2],2,'0',STR_PAD_LEFT)];
    }
    if (preg_match('/(\d{1,2})[xX](\d{1,3})/', $base, $m)) {
        return ['season' => (int)$m[1], 'episode' => (int)$m[2],
                'code' => 'S'.str_pad($m[1],2,'0',STR_PAD_LEFT).'E'.str_pad($m[2],2,'0',STR_PAD_LEFT)];
    }
    if (preg_match('/[Ee]p?(\d{1,3})/', $base, $m)) {
        return ['season' => 1, 'episode' => (int)$m[1],
                'code' => 'S01E'.str_pad($m[1],2,'0',STR_PAD_LEFT)];
    }
    if (preg_match('/^(\d{1,3})[\s\-_\.]/', $base, $m)) {
        return ['season' => 1, 'episode' => (int)$m[1],
                'code' => 'E'.str_pad($m[1],2,'0',STR_PAD_LEFT)];
    }
    return ['season' => 1, 'episode' => 999, 'code' => ''];
}

function formatSize(int $bytes): string {
    if ($bytes >= 1_073_741_824) return number_format($bytes / 1_073_741_824, 1) . ' GB';
    if ($bytes >= 1_048_576)     return number_format($bytes / 1_048_576, 1) . ' MB';
    if ($bytes >= 1_024)         return number_format($bytes / 1_024, 0) . ' KB';
    return $bytes . ' B';
}

function getVideoDuration(string $filePath, int $fileSize): string {
    $d = tryFfprobe($filePath); if ($d) return $d;
    $d = tryFfmpeg($filePath);  if ($d) return $d;
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if (in_array($ext, ['mp4', 'm4v', 'mov'])) {
        $d = getMp4Duration($filePath); if ($d) return $d;
    }
    return formatDuration(max(60, intval($fileSize / 200_000)));
}

function tryFfprobe(string $filePath): ?string {
    if (!commandExists('ffprobe')) return null;
    $out = shell_exec(sprintf('ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 %s 2>/dev/null', escapeshellarg($filePath)));
    if (!$out) return null;
    $s = floatval(trim($out));
    return $s > 0 ? formatDuration((int)$s) : null;
}

function tryFfmpeg(string $filePath): ?string {
    if (!commandExists('ffmpeg')) return null;
    exec(sprintf('ffmpeg -i %s 2>&1', escapeshellarg($filePath)), $out);
    $str = implode("\n", $out);
    if (preg_match('/Duration:\s*(\d{2}):(\d{2}):(\d{2})/', $str, $m)) {
        return formatDuration((int)$m[1]*3600 + (int)$m[2]*60 + (int)$m[3]);
    }
    return null;
}

function getMp4Duration(string $filePath): ?string {
    $fp = fopen($filePath, 'rb'); if (!$fp) return null;
    $duration = null; $size = filesize($filePath); $pos = 0;
    while ($pos < $size - 8) {
        fseek($fp, $pos);
        $h = fread($fp, 8); if (strlen($h) < 8) break;
        $boxSize = unpack('N', substr($h,0,4))[1];
        $boxType = substr($h, 4, 4);
        if ($boxSize < 8) break;
        if ($boxType === 'moov') {
            $d = fread($fp, min($boxSize-8, 1_000_000));
            $mp = strpos($d, 'mvhd');
            if ($mp !== false && strlen($d) >= $mp+24) {
                $v = ord($d[$mp+4]);
                if ($v === 0) { $ts = unpack('N',substr($d,$mp+12,4))[1]; $rd = unpack('N',substr($d,$mp+16,4))[1]; }
                else          { $ts = unpack('N',substr($d,$mp+20,4))[1]; $rd = unpack('J',substr($d,$mp+24,8))[1]; }
                if ($ts > 0) $duration = formatDuration((int)($rd/$ts));
            }
            break;
        }
        $pos += $boxSize;
    }
    fclose($fp);
    return $duration;
}

function formatDuration(int $s): string {
    $h = intdiv($s,3600); $m = intdiv($s%3600,60); $sec = $s%60;
    return $h > 0 ? sprintf('%d:%02d:%02d',$h,$m,$sec) : sprintf('%d:%02d',$m,$sec);
}

function commandExists(string $cmd): bool {
    static $c = [];
    if (isset($c[$cmd])) return $c[$cmd];
    $win = DIRECTORY_SEPARATOR === '\\';
    exec($win ? "where $cmd >nul 2>&1" : "command -v $cmd >/dev/null 2>&1", $o, $code);
    return $c[$cmd] = ($code === 0);
}
