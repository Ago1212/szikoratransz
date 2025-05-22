<?php

class EmailInterface {
    protected $db;

    public function __construct() {
        // Adatbázis kapcsolat inicializálása, ha szükséges
        // $this->db = new PDO(...);
    }

    public function sendAjanlatkeres(string $name, string $email, string $phone, string $message) {
        $subject = "Új ajánlatkérés érkezett: $name";

        $body = '
            <div style="font-family:sans-serif;">
                <div style="background-color:#2563eb; color:white; padding:12px; border-radius:6px; display:inline-block; margin-bottom:16px;">
                    <h2>Ajánlatkérés</h2>
                </div>
                <p><strong>Név:</strong> ' . htmlspecialchars($name) . '</p>
                <p><strong>E-mail:</strong> ' . htmlspecialchars($email) . '</p>
                <p><strong>Telefonszám:</strong> ' . htmlspecialchars($phone) . '</p>
                <p><strong>Üzenet:</strong><br>' . nl2br(htmlspecialchars($message)) . '</p>
            </div>
        ';

        return $this->sendEmail($email, 'szikoratransz@gmail.com', $subject, $body);
    }

    public function sendJelentkezes(string $name, string $email, string $phone, string $message) {
        $subject = "Új jelentkezés: $name";

        $body = '
            <div style="font-family:sans-serif;">
                <div style="background-color:#f97316; color:white; padding:12px; border-radius:6px; display:inline-block; margin-bottom:16px;"> 
                    <h2>Sofőr jelentkezés</h2>
                </div>
                <p><strong>Név:</strong> ' . htmlspecialchars($name) . '</p>
                <p><strong>E-mail:</strong> ' . htmlspecialchars($email) . '</p>
                <p><strong>Telefonszám:</strong> ' . htmlspecialchars($phone) . '</p>
                <p><strong>Üzenet:</strong><br>' . nl2br(htmlspecialchars($message)) . '</p>
            </div>
        ';

        return $this->sendEmail($email, 'szikoratransz@gmail.com', $subject, $body);
    }

    protected function sendEmail(string $from, string $to, string $subject, string $body) {
        // Alap e-mail küldési logika
        $headers = [
            'From' => "agoston@ps.hu",
            'Reply-To' => $from,
            'X-Mailer' => 'PHP/' . phpversion(),
            'Content-Type' => 'text/html; charset=utf-8'
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
