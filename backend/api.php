<?php

require_once 'config.php';
require_once 'ApiHandler.php';
header("Access-Control-Allow-Origin: *"); // Engedélyezzük a http://localhost:3000 domaint
header("Access-Control-Allow-Headers: Content-Type, Authorization"); // Engedélyezzük a szükséges fejléceket
header("Access-Control-Allow-Methods: POST, GET, OPTIONS"); // Engedélyezzük a POST, GET és OPTIONS kéréseket
header('Content-Type: application/json; charset=UTF-8');

$request = json_decode(file_get_contents("php://input"), true);

$api = new ApiHandler($apiConfig['authHash']);
$api->process($request);
      