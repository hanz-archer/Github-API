<?php
use Illuminate\Support\Facades\Http;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Process;
use Illuminate\Http\Request;

Route::get('/github-token', function () {
    return response()->json([
        'token' => config('github.token')
    ]);
});

Route::get('/pull-requests', function () {
    $response = Http::withToken(config('github.token'))
        ->get('https://api.github.com/repos/hans-zanecoder/Github-API/pulls');
    
    return $response->json();
});

Route::post('/clone-repository', function (Request $request) {
    $cloneUrl = $request->input('cloneUrl');
    $targetDir = storage_path('app/repos/' . basename($cloneUrl, '.git'));
    
    try {
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0755, true);
        }
        
        $result = Process::run("git clone {$cloneUrl} {$targetDir}");
        
        if ($result->successful()) {
            return response()->json(['success' => true]);
        } else {
            return response()->json([
                'success' => false,
                'message' => $result->errorOutput()
            ], 500);
        }
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
});
