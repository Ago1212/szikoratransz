<?php

class EmailInterface {
    protected $db;

    // Arculati konstansok — a src/tailwind.config.js brand/ink/ember
    // tokenjeivel (és a nyilvános landing oldal Footer.js kontakt-adataival)
    // szinkronban tartva. Az e-mail kliensek (Outlook/Gmail) nem tudnak
    // Tailwind osztályt vagy külső CSS-t értelmezni, ezért ugyanezeket a
    // színeket itt hex-kódként, inline stílusban kell megismételni.
    const LOGO_URL = 'https://szikora-transz.hu/logo.png';
    const LOGO_BG = '#000666'; // a logo.png saját sötétkék háttérszíne (image-blokkolás esetén ez a fallback)
    const FOOTER_BG = '#23262b'; // ink-800
    const FOOTER_TEXT = '#c7c8cb'; // ink-200
    const FOOTER_MUTED = '#6b6d73'; // ink-400 — a projekt kontraszt-szabálya szerint ez a padló szöveghez

    const TONES = [
        // bg / text pár — a CardStats.js TONE-jaival megegyező szemantika (brand/positive/warning)
        'brand' => ['bg' => '#eef1fd', 'text' => '#253fc0'],
        'positive' => ['bg' => '#ecfdf5', 'text' => '#059669'],
        'neutral' => ['bg' => '#e5e5e7', 'text' => '#35373c'],
        'warning' => ['bg' => '#fffbeb', 'text' => '#b45309'],
        'danger' => ['bg' => '#fef2f2', 'text' => '#b91c1c'],
    ];

    public function __construct() {
        // Adatbázis kapcsolat inicializálása, ha szükséges
        // $this->db = new PDO(...);
    }

    public function sendAjanlatkeres(string $name, string $email, string $phone, string $message) {
        $subject = "Új ajánlatkérés érkezett: $name";

        $content = $this->row('Név', $name)
            . $this->row('E-mail', $email)
            . $this->row('Telefonszám', $phone)
            . $this->row('Üzenet', nl2br(htmlspecialchars($message)), true);

        $body = $this->layout('Új ajánlatkérés', 'brand', $content);

        return $this->sendEmail($email, 'szikoratransz@gmail.com', $subject, $body);
    }

    public function sendJelentkezes(string $name, string $email, string $phone, string $message) {
        $subject = "Új jelentkezés: $name";

        $content = $this->row('Név', $name)
            . $this->row('E-mail', $email)
            . $this->row('Telefonszám', $phone)
            . $this->row('Üzenet', nl2br(htmlspecialchars($message)), true);

        $body = $this->layout('Sofőr jelentkezés', 'positive', $content);

        return $this->sendEmail($email, 'szikoratransz@gmail.com', $subject, $body);
    }

    // Jelszó-visszaállítási e-mail — a linket egy márkázott gombként jeleníti meg
    // sima kék aláhúzott hivatkozás helyett.
    public function sendJelszoVisszaallitas(string $email, string $resetUrl) {
        $content = '<p style="margin:0 0 20px 0;">Jelszó-visszaállítást kért a Szikora Transz flottakezelő rendszerben.</p>'
            . $this->button($resetUrl, 'Új jelszó beállítása')
            . '<p style="margin:24px 0 0 0;color:' . self::FOOTER_MUTED . ';font-size:13px;">A hivatkozás 1 óráig érvényes. Ha nem Ön kérte, hagyja figyelmen kívül ezt az e-mailt.</p>';

        $body = $this->layout('Jelszó-visszaállítás', 'neutral', $content);

        return $this->sendEmail($email, $email, 'Jelszó-visszaállítás — Szikora Transz', $body);
    }

    // Lejárat-emlékeztető — a napi cron script (backend/cron/lejarat_emlekezteto.php)
    // hívja, egy admin összes közelgő lejáratának listájával.
    public function sendLejaratEmlekezteto(string $email, string $adminName, array $items, int $windowDays) {
        $listHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;">';
        foreach ($items as $item) {
            $listHtml .= '<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e7;font-size:14px;color:#23262b;">'
                . '<span style="color:#b45309;">&#9679;</span> ' . htmlspecialchars($item) . '</td></tr>';
        }
        $listHtml .= '</table>';

        $content = '<p style="margin:0 0 16px 0;">Kedves ' . htmlspecialchars($adminName) . '!</p>'
            . '<p style="margin:0 0 4px 0;">A következő ' . (int) $windowDays . ' napban az alábbi határidők járnak le:</p>'
            . $listHtml
            . $this->button('https://szikora-transz.hu/admin/esemenyek', 'Események megtekintése');

        $body = $this->layout('Lejáró határidők', 'warning', $content);

        return $this->sendEmail($email, $email, 'Közelgő lejáratok — Szikora Transz', $body);
    }

    // Publikus belépési pont más jövőbeli automatikus értesítéseknek — a
    // márkázott layout-ba csomagolja a hívó által átadott, már kész HTML
    // tartalmat, hogy minden jövőbeli e-mail automatikusan öröklje az
    // arculatot anélkül, hogy a hívónak ismernie kellene a layout-ot.
    public function sendNotification(string $to, string $subject, string $body) {
        $branded = $this->layout('Értesítés', 'brand', $body);
        return $this->sendEmail($to, $to, $subject, $branded);
    }

    // Egy márkázott, táblázat-alapú HTML e-mail váz — logó fejléc, fehér
    // tartalom-kártya egy szemantikus jelvénnyel (badge), sötét lábléc a cég
    // elérhetőségeivel. Táblázat-alapú elrendezés és inline stílusok, mert az
    // Outlook/Gmail nem támogat flexbox/grid-et és gyakran a külső CSS-t is
    // blokkolja.
    private function layout(string $badgeLabel, string $tone, string $contentHtml): string {
        $t = self::TONES[$tone] ?? self::TONES['brand'];

        return '<!DOCTYPE html>'
            . '<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
            . '<title>Szikora Transz</title></head>'
            . '<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">'
            . '<tr><td align="center">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">'
            . '<tr><td align="center" bgcolor="' . self::LOGO_BG . '" style="background-color:' . self::LOGO_BG . ';padding:28px 24px;">'
            . '<img src="' . self::LOGO_URL . '" width="200" alt="Szikora Transz" style="display:block;width:200px;max-width:200px;height:auto;border:0;">'
            . '</td></tr>'
            . '<tr><td style="padding:32px 32px 8px 32px;">'
            . '<span style="display:inline-block;background-color:' . $t['bg'] . ';color:' . $t['text'] . ';font-size:12px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;padding:6px 14px;border-radius:999px;">' . htmlspecialchars($badgeLabel) . '</span>'
            . '</td></tr>'
            . '<tr><td style="padding:16px 32px 32px 32px;color:#23262b;font-size:15px;line-height:1.6;">'
            . $contentHtml
            . '</td></tr>'
            . '<tr><td bgcolor="' . self::FOOTER_BG . '" style="background-color:' . self::FOOTER_BG . ';padding:24px 32px;color:' . self::FOOTER_TEXT . ';font-size:12px;line-height:1.7;">'
            . '<strong style="color:#ffffff;font-size:13px;">Szikora Transz Kft.</strong><br>'
            . '2518 Leányvár, Bécsi út 86 &middot; Adószám: 26381626-2-11<br>'
            . '<a href="tel:+36308115776" style="color:' . self::FOOTER_TEXT . ';text-decoration:underline;">+36 30 811 5776</a> &middot; '
            . '<a href="mailto:szikoratransz@gmail.com" style="color:' . self::FOOTER_TEXT . ';text-decoration:underline;">szikoratransz@gmail.com</a>'
            . '<br><span style="color:' . self::FOOTER_MUTED . ';">Ez egy automatikusan generált e-mail a Szikora Transz flottakezelő rendszeréből.</span>'
            . '</td></tr>'
            . '</table>'
            . '</td></tr></table>'
            . '</body></html>';
    }

    // Egy címke/érték sor az ajánlatkérés/jelentkezés e-mailekhez.
    // $raw = true esetén a $value már escape-elt/HTML-t tartalmaz (pl. nl2br után).
    private function row(string $label, string $value, bool $raw = false): string {
        $displayValue = $raw ? $value : htmlspecialchars($value);
        return '<p style="margin:0 0 12px 0;">'
            . '<strong style="color:#35373c;">' . htmlspecialchars($label) . ':</strong> '
            . '<span style="color:#23262b;">' . $displayValue . '</span>'
            . '</p>';
    }

    // Márkázott CTA gomb — sima <a>, mert táblázatba ágyazott "bulletproof"
    // gomb ehhez a belső, alacsony e-mail-mennyiséghez felesleges komplexitás.
    private function button(string $url, string $label): string {
        return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr><td bgcolor="#2F4DE0" style="background-color:#2F4DE0;border-radius:8px;">'
            . '<a href="' . htmlspecialchars($url) . '" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none;">' . htmlspecialchars($label) . '</a>'
            . '</td></tr></table>';
    }

    protected function sendEmail(string $from, string $to, string $subject, string $body) {
        // A From domain SZÁNDÉKOSAN szikora-transz.hu, NEM ps.hu — a ps.hu
        // domainnek van egy `_dmarc.ps.hu` TXT rekordja `p=quarantine`
        // szabállyal, miközben a kimenő levelek nincsenek DKIM-mel aláírva
        // egyik domainhez sem. Amíg a From ps.hu volt, ps.hu SAJÁT DMARC
        // policy-je utasította a Gmailt (és minden DMARC-ot respektáló
        // fogadó szervert), hogy a nem-illeszkedő (DKIM-hiányos) leveleket
        // tegye spambe — élesben ellenőrizve: emiatt ment MIND a 4 kimenő
        // e-mail-típus (ajánlatkérés, jelentkezés, jelszó-visszaállítás,
        // lejárat-cron) egységesen spambe, nem csak egy-kettő.
        // A szikora-transz.hu domainnek nincs DMARC rekordja (`dig TXT
        // _dmarc.szikora-transz.hu` üres) és a saját SPF-je (`v=spf1 a mx
        // -all`) explicit engedélyezi ezt a szervert — nincs tehát
        // kényszerítő quarantine-szabály, amit a Gmailnek követnie kellene.
        $headers = [
            'From' => "Szikora Transz <noreply@szikora-transz.hu>",
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
