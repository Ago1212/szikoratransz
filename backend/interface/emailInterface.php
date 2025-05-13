<?php

class EmailInterface {
    protected $db;

    public function __construct() {
        // Adatbázis kapcsolat inicializálása, ha szükséges
        // $this->db = new PDO(...);
    }

    public function sendAjanlatkeres(string $name, string $email, string $phone, string $message) {
        // E-mail küldés logikája ajánlatkéréshez
        $subject = "Új ajánlatkérés érkezett: $name";
        $body = "Név: $name\n";
        $body .= "E-mail: $email\n";
        $body .= "Telefonszám: $phone\n";
        $body .= "Üzenet:\n$message";

        return $this->sendEmail($email, 'sziago12@gmail.com', $subject, $body);
    }

    public function sendJelentkezes(string $name, string $email, string $phone, string $message) {
        // E-mail küldés logikája jelentkezéshez
        $subject = "Új jelentkezés: $name";
        $body = "Név: $name\n";
        $body .= "E-mail: $email\n";
        $body .= "Telefonszám: $phone\n";
        $body .= "Üzenet:\n$message";

        return $this->sendEmail($email, 'szikoratransz@gmail.com', $subject, $body);
    }

    protected function sendEmail(string $from, string $to, string $subject, string $body) {
        // Alap e-mail küldési logika
        $headers = [
            'From' => $from,
            'Reply-To' => $from,
            'X-Mailer' => 'PHP/' . phpversion(),
            'Content-Type' => 'text/plain; charset=utf-8'
        ];

        $headerString = '';
        foreach ($headers as $key => $value) {
            $headerString .= "$key: $value\r\n";
        }

        try {
            $result = mail($to, $subject, $body, $headerString);
            if (!$result) {
                error_log("Email sending failed to $to");
                return ['success' => false];
            }
            return ['success' => true];
        } catch (Exception $e) {
            error_log("Email sending error: " . $e->getMessage());
            return ['success' => false];
        }
    }
}

$emailInterface = new EmailInterface();
