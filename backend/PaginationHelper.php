<?php

// Egységes szerver oldali lapozás/keresés-segéd minden lista-akcióhoz
// (Kamionok, Potkocsik, Sofőrök, Ügyfelek, ...). A cél, hogy minden
// interface-fájl ugyanazt a COUNT+LIMIT/OFFSET mintát használja egy
// helyen definiálva, ahelyett hogy mindegyik saját maga építené fel
// (és esetleg máshogy rontaná el) ugyanazt a két lekérdezést.
//
// `page`/`pageSize` param NÉLKÜL hívva (ApiHandler mindig átadja, ha a
// kliens nem küldött ilyet) minden érintett metódus a régi, "adj vissza
// mindent egyszerre" viselkedést tartja meg — a lapozás szigorúan opt-in,
// hogy egyetlen más (nem lista-oldali) hívó se törjön el emiatt.
class PaginationHelper {
    public static function normalize($page, $pageSize, $defaultPageSize = 20, $maxPageSize = 500) {
        $page = max(1, (int) ($page ?: 1));
        $pageSize = (int) ($pageSize ?: $defaultPageSize);
        $pageSize = max(1, min($maxPageSize, $pageSize));
        return [$page, $pageSize];
    }

    // OR-kapcsolt LIKE-feltétel több oszlopra egyetlen szabadszavas
    // kereséshez. `$paramKey` legyen hívásonként/ágazatonként egyedi,
    // ha egy UNION query mindkét ágában szerepel (ld. Karbantartások).
    public static function likeClause(array $columns, $paramKey) {
        $parts = array_map(fn($col) => "$col LIKE :$paramKey", $columns);
        return '(' . implode(' OR ', $parts) . ')';
    }

    // `$baseQuery`: teljes SELECT, WHERE/ORDER BY-jal, LIMIT NÉLKÜL.
    // Egy alkérdésbe csomagolva megszámolja az össz-találatot, majd
    // LIMIT/OFFSET-et fűz a végére a lapozott sorokért — a hívónak nem
    // kell külön karbantartania egy COUNT és egy SELECT lekérdezést.
    public static function fetchPage($db, $baseQuery, array $params, $page, $pageSize, $defaultPageSize = 20) {
        [$page, $pageSize] = self::normalize($page, $pageSize, $defaultPageSize);
        $offset = ($page - 1) * $pageSize;

        $countStmt = $db->prepare("SELECT COUNT(*) AS cnt FROM ($baseQuery) AS pg_count");
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetch(PDO::FETCH_ASSOC)['cnt'];

        $stmt = $db->prepare("$baseQuery LIMIT :pg_limit OFFSET :pg_offset");
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':pg_limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':pg_offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [$rows, $total, $page, $pageSize];
    }
}
