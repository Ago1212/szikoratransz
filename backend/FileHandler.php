<?php

class FileHandler {
    private $filePath;

    public function __construct(string $filePath) {
        $this->filePath = $filePath;
    }

    public function readFromFile(): array {
        return file_exists($this->filePath) ? json_decode(file_get_contents($this->filePath), true) : [];
    }

    public function writeToFile(array $data): void {
        file_put_contents($this->filePath, json_encode($data, JSON_PRETTY_PRINT));
    }

    public function addUserToFile($user) {
        $users = $this->readFromFile();
        $users[] = $user;
        $this->writeToFile($users);
    }

    public function updateUserInFile($id, $nickname, $birthdate,$hashedPassword) {
        $users = $this->readFromFile();
        foreach ($users as &$user) {
            if ($user['id'] == $id) {
                $user['nickname'] = $nickname;
                $user['birthdate'] = $birthdate;
                if($hashedPassword){
                    $user['password'] = $hashedPassword;
                }
                break;
            }
        }
        $this->writeToFile($users);
    }

    public function getUserFromFile($email) {
        $users = $this->readFromFile();
        foreach ($users as $user) {
            if ($user['email'] == $email) {
                return $user;
            }
        }
        return [];
    }
    
}
