<?php
require 'db.php';
require 'interface/kamionInterface.php';
require 'interface/potkocsiInterface.php';
require 'interface/soforokInterface.php';
require 'interface/filesInterface.php';

class ApiHandler {
    protected string $auth_hash;
    protected array $actions = [];
    protected $db;

    public function __construct(string $auth_hash) {
        $this->auth_hash = $auth_hash;
        $this->actions = $this->getActions();
        $database = new Database();
        $this->db = $database->connect();
    }

    private function getActions(): array {
        return [
            'loginUser' => ['email', 'password'],
            'logoutUser' => [],
            'getSum' => ['id'],
            'saveAdminData' => ['id'],
            'newKamion' => ['rendszam'],
            'saveKamionData' => ['id'],
            'getKamionok'=>['id'],
            'deleteKarbantartas'=>['id'],
            'setKarbantartasKesz'=>['id','elvegzett'],
            'updateKarbantartas'=>['log','kamion_id','datum'],
            'getKarbantartas'=>['kamion_id', 'elvegzett'],
            'deleteKamion' => ['id'],

            'newPotkocsi' => ['rendszam'],
            'savePotkocsiData' => ['id'],
            'getPotkocsik'=>['id'],
            'deletePotkocsiKarbantartas'=>['id'],
            'setPotkocsiKarbantartasKesz'=>['id','elvegzett'],
            'updatePotkocsiKarbantartas'=>['log','potkocsi_id','datum'],
            'getPotkocsiKarbantartas'=>['potkocsi_id', 'elvegzett'],
            'deletePotkocsi' => ['id'],

            'getSoforok'=>['id'],
            'newSofor' => ['name','email'],
            'saveSoforData' => ['id'],
            'deleteSofor' => ['id'],

            'getFiles'=>['id','tabla'],
            'fileUpload'=>['id','tabla','file','name','size'],
            'deleteFile'=>['id'],
            'downloadFile'=>['id'],
        ];
    }

    private function validation(?array $request) {
        if (empty($request)) {
            throw new Exception('Request body is empty.');
        }

        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? '';
        $authHash = str_replace('Bearer ', '', $authHeader);

        if ($this->auth_hash !== $authHash) {
            throw new Exception('Authorization failed.');
        }

        if (!isset($request['action']) || !array_key_exists($request['action'], $this->actions)) {
            $action = $request['action'] ?? "";
            throw new Exception("Invalid action: $action.");
        }

        foreach ($this->actions[$request['action']] as $key) {
            if (!array_key_exists($key, $request)) {
                throw new Exception("Missing parameter: $key.");
            }
        }
        if(isset($request['email']) && !filter_var($request['email'], FILTER_VALIDATE_EMAIL)){
            throw new Exception('Invalid email format.');
        }
        if(isset($request['email']) && isset($request['id']) ){
            $this->validateUniqueEmail($request['email'],$request['id']);
        }
    }

    public function process(?array $request) {
        global $kamionInterface,$potkocsiInterface,$soforokInterface,$filesInterface;
        try {
            $this->validation($request);
            $action = $request['action'];

            switch ($action) {
                case 'loginUser':
                    echo json_encode($this->loginUser($request['email'], $request['password']));
                    return;
                case 'getSum':
                    echo json_encode($this->getSum($request['id']));
                    return;
                case 'updateUser':
                    echo json_encode($this->updateUser($request['id'], $request['nickname'], $request['birthdate'], $request['password']));
                    return;
                case 'logoutUser':
                    echo json_encode($this->logoutUser($request['id']));
                    return;
                case 'saveKamionData':
                    echo json_encode($kamionInterface->saveKamionData($request));
                    return;
                case 'newKamion':
                    echo json_encode($kamionInterface->newKamion($request));
                    return;
                case 'getKamionok':
                    echo json_encode($kamionInterface->getKamionok($request['id']));
                    return;
                case 'deleteKamion':
                    echo json_encode($kamionInterface->deleteKamion($request['id']));
                    return;
                case 'getKarbantartas':
                    echo json_encode($kamionInterface->getKarbantartas($request['kamion_id'],$request['elvegzett']));
                    return;
                case 'updateKarbantartas':
                    echo json_encode($kamionInterface->updateKarbantartas(isset($request['id'])?$request['id']:0,$request['kamion_id'],$request['datum'],$request['log']));
                    return;
                case 'setKarbantartasKesz':
                    echo json_encode($kamionInterface->setKarbantartasKesz($request['id'],$request['elvegzett']));
                    return;
                case 'deleteKarbantartas':
                    echo json_encode($kamionInterface->deleteKarbantartas($request['id']));
                    return;
                case 'savePotkocsiData':
                    echo json_encode($potkocsiInterface->savePotkocsiData($request));
                    return;
                case 'newPotkocsi':
                    echo json_encode($potkocsiInterface->newPotkocsi($request));
                    return;
                case 'deletePotkocsi':
                    echo json_encode($potkocsiInterface->deletePotkocsi($request['id']));
                    return;
                case 'getPotkocsik':
                    echo json_encode($potkocsiInterface->getPotkocsik($request['id']));
                    return;
                case 'getPotkocsiKarbantartas':
                    echo json_encode($potkocsiInterface->getPotkocsiKarbantartas($request['potkocsi_id'],$request['elvegzett']));
                    return;
                case 'updatePotkocsiKarbantartas':
                    echo json_encode($potkocsiInterface->updatePotkocsiKarbantartas(isset($request['id'])?$request['id']:0,$request['potkocsi_id'],$request['datum'],$request['log']));
                    return;
                case 'setPotkocsiKarbantartasKesz':
                    echo json_encode($potkocsiInterface->setPotkocsiKarbantartasKesz($request['id'],$request['elvegzett']));
                    return;
                case 'deletePotkocsiKarbantartas':
                    echo json_encode($potkocsiInterface->deletePotkocsiKarbantartas($request['id']));
                    return;
                case 'getSoforok':
                    echo json_encode($soforokInterface->getSoforok($request['id']));
                    return;
                case 'newSofor':
                    echo json_encode($soforokInterface->newSofor($request));
                    return;
                case 'saveSoforData':
                    echo json_encode($soforokInterface->saveSoforData($request));
                    return;
                case 'deleteSofor':
                    echo json_encode($soforokInterface->deleteSofor($request['id']));
                    return;
                case 'getFiles':
                    echo json_encode($filesInterface->getFiles($request['tabla'],$request['id']));
                    return;
                case 'fileUpload':
                    echo json_encode($filesInterface->fileUpload($request['tabla'],$request['id'],$request['file'],$request['name'],$request['size']));
                    return;
                case 'downloadFile':
                    echo json_encode($filesInterface->downloadFile($request['id']));
                    return;
                case 'deleteFile':
                    echo json_encode($filesInterface->deleteFile($request['id']));
                    return;
                case 'saveAdminData':echo json_encode($this->saveAdminData(
                    $request['id'],
                    $request['name'],
                    $request['email'],
                    $request['phone'],
                    $request['szul_datum'],
                    $request['szemelyi'],
                    $request['varos'],
                    $request['irsz'],
                    $request['cim'],
                    $request['szemelyi_lejarat'],
                    $request['jogsi_lejarat'],
                    $request['gki_lejarat'],
                    $request['adr_lejarat']
                ));
                
                    return;
            }             
        } catch (Exception $e) {
            $message = ["error" => true, "message" => $e->getMessage()];
            echo json_encode($message);
        } 
    }

    private function getSum($id) {
        try {    
            $query = "SELECT IFNULL(COUNT(id),0) as id FROM user WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_soforok = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $query = "SELECT IFNULL(COUNT(id),0) as id FROM kamion WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_kamion = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $query = "SELECT IFNULL(COUNT(id),0) as id FROM potkocsi WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_potkocsi = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $sum_hatarido = $this->getHataridok($id);
            
            return ['success' => true, 'sofor'=>$sum_soforok, 'kamion'=>$sum_kamion,'potkocsi'=>$sum_potkocsi,'hatarido'=>$sum_hatarido];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    function getHataridok($id){
        return "0";
    }
    
    private function loginUser($email, $password) {
        $user = $this->getUser($email);
        if (!empty($user) && password_verify($password, $user['password'])) {
            return ['success' => true, 'user' => $user];
        }
        return ['success' => false, 'message' => 'Login failed. Incorrect email or password.'];
    }

    private function logoutUser() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        session_unset();
        session_destroy();
        return ['success' => true, 'message' => 'Successfully logged out.'];
    }

    private function saveAdminData($id, $name, $email, $phone, $szul_datum, $szemelyi, $varos, $irsz, $cim, $szemelyi_lejarat, $jogsi_lejarat, $gki_lejarat, $adr_lejarat) {
        try {
            $query = "UPDATE admin 
                      SET name = :name, 
                          email = :email, 
                          phone = :phone, 
                          szul_datum = :szul_datum, 
                          szemelyi = :szemelyi, 
                          varos = :varos, 
                          irsz = :irsz, 
                          cim = :cim, 
                          szemelyi_lejarat = :szemelyi_lejarat, 
                          jogsi_lejarat = :jogsi_lejarat, 
                          gki_lejarat = :gki_lejarat, 
                          adr_lejarat = :adr_lejarat 
                      WHERE id = :id";
            
            $stmt = $this->db->prepare($query);
    
            // Paraméterek kötése
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':name', $name, PDO::PARAM_STR);
            $stmt->bindParam(':email', $email, PDO::PARAM_STR);
            $stmt->bindParam(':phone', $phone, PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $szul_datum, PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $szemelyi, PDO::PARAM_STR);
            $stmt->bindParam(':varos', $varos, PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $irsz, PDO::PARAM_STR);
            $stmt->bindParam(':cim', $cim, PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $szemelyi_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $jogsi_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $gki_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $adr_lejarat, PDO::PARAM_STR);
    
            // Lekérdezés végrehajtása
            $stmt->execute();
            $user = $this->getUser($email);
            return ['success' => true, 'user' => $user];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function updateUser($id, $nickname, $birthdate,$password=null) {
        try {
            $query = "UPDATE user SET nickname = :nickname, birthdate = :birthdate";
            $hashedPassword = null;
            if ($password) {
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $query .= ", password = :password";
            }
            $query .= " WHERE id = :id";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':nickname', $nickname);
            $stmt->bindParam(':birthdate', $birthdate);
            if ($password) {
                $stmt->bindParam(':password', $hashedPassword);
            }
            $stmt->execute();

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function getUser($email) {
        $query = "SELECT *,false as admin FROM user WHERE email = :email";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if(empty($user)){
            $query = "SELECT *,true as admin FROM admin WHERE email = :email";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            return $stmt->fetch(PDO::FETCH_ASSOC);
        }

        return $user;
    }

    private function validateUniqueEmail($email, $id) {
        $query = "SELECT COUNT(*) FROM user WHERE email = :email AND id != :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':email', $email, PDO::PARAM_STR);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $count = $stmt->fetchColumn();
    
        if ($count > 0) {
            throw new Exception('The email address is already in use.');
        }
    }
    
}
