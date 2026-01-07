Algoritma Minimax dengan Alpha-Beta Pruning - Penjelasan cara kerja algoritma pencarian game tree
Sistem Evaluasi State - Bagaimana AI menilai posisi permainan
Sistem Bobot Karakter - Tier system dari Tier S hingga D dengan nilai dan alasan
Tactical Scan (Forced Lines) - Deteksi mate-in-1 dan mate-in-2
Move Ordering Heuristic - Cara AI mengurutkan langkah untuk optimisasi
Threat Assessment System - Sistem deteksi ancaman checkmate
Counter-Pick & Synergy Analysis - Analisis kombinasi karakter yang efektif
Strategic Placement System - Klasifikasi unit dan scoring penempatan
Nemesis Move Selection - Algoritma khusus untuk karakter Nemesis
Performa & Optimisasi - Time management dan logging


# 🤖 Fitur-Fitur AI dalam Game

Dokumen ini menjelaskan secara detail fitur-fitur kecerdasan buatan (Artificial Intelligence) yang diimplementasikan dalam game ini.

---

## 📋 Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Algoritma Minimax dengan Alpha-Beta Pruning](#algoritma-minimax-dengan-alpha-beta-pruning)
3. [Sistem Evaluasi State](#sistem-evaluasi-state)
4. [Sistem Bobot Karakter (Character Weights)](#sistem-bobot-karakter-character-weights)
5. [Tactical Scan - Forced Lines Detection](#tactical-scan---forced-lines-detection)
6. [Move Ordering Heuristic](#move-ordering-heuristic)
7. [Threat Assessment System](#threat-assessment-system)
8. [Counter-Pick & Synergy Analysis](#counter-pick--synergy-analysis)
9. [Strategic Placement System](#strategic-placement-system)
10. [Nemesis Move Selection](#nemesis-move-selection)

---

## Gambaran Umum

AI dalam game ini menggunakan kombinasi berbagai teknik kecerdasan buatan untuk mengambil keputusan:

| Komponen | Deskripsi |
|----------|-----------|
| **Minimax Algorithm** | Algoritma pencarian game tree untuk menentukan langkah terbaik |
| **Alpha-Beta Pruning** | Optimisasi untuk memangkas cabang yang tidak perlu dieksplorasi |
| **Heuristic Evaluation** | Fungsi evaluasi untuk menilai kekuatan posisi |
| **Tactical Scanning** | Deteksi ancaman dan peluang checkmate |
| **Dynamic Weights** | Penyesuaian nilai karakter berdasarkan konteks permainan |

---

## Algoritma Minimax dengan Alpha-Beta Pruning

### Cara Kerja

Algoritma Minimax adalah algoritma pencarian pohon keputusan yang digunakan dalam game dua pemain. AI akan:

1. **Membangun Game Tree** - Memprediksi semua kemungkinan langkah hingga kedalaman tertentu
2. **Mengevaluasi Leaf Nodes** - Menilai setiap posisi akhir dengan fungsi evaluasi
3. **Propagasi Nilai** - Memilih langkah terbaik dengan asumsi lawan juga bermain optimal

### Konfigurasi

```
MAX_DEPTH = 4  // Kedalaman pencarian optimal untuk performa web
INFINITY = 1000000  // Nilai untuk kondisi menang/kalah
```

### Alpha-Beta Pruning

Alpha-Beta Pruning mengurangi jumlah node yang perlu dievaluasi:

- **Alpha**: Nilai terbaik yang sudah ditemukan untuk Maximizer
- **Beta**: Nilai terbaik yang sudah ditemukan untuk Minimizer
- **Pruning**: Jika `beta <= alpha`, cabang dapat dipotong karena tidak akan dipilih

### Pseudocode

```
function minimax(state, depth, alpha, beta, isMaximizing):
    if depth == 0 or game_over:
        return evaluate(state)
    
    if isMaximizing:
        maxEval = -INFINITY
        for each move in possible_moves:
            eval = minimax(apply(move), depth-1, alpha, beta, false)
            maxEval = max(maxEval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha: break  // Pruning
        return maxEval
    else:
        minEval = INFINITY
        for each move in possible_moves:
            eval = minimax(apply(move), depth-1, alpha, beta, true)
            minEval = min(minEval, eval)
            beta = min(beta, eval)
            if beta <= alpha: break  // Pruning
        return minEval
```

---

## Sistem Evaluasi State

### Komponen Evaluasi

AI mengevaluasi posisi berdasarkan beberapa faktor:

#### 1. **Material Score** (Nilai Unit di Papan)
Setiap unit memiliki nilai intrinsik berdasarkan kemampuannya.

#### 2. **Hand Score** (Nilai Kartu di Tangan)
Kartu di tangan dihitung 50% dari nilai di papan (potensi di masa depan).

#### 3. **Leader Safety** (Keamanan Pemimpin)
- **Captured/Surrounded**: -10,000 poin jika pemimpin AI terancam
- **Enemy Vulnerable**: +10,000 poin jika pemimpin lawan terancam

#### 4. **Threat Awareness** (Kesadaran Ancaman)
AI menganalisis ancaman spesifik dari setiap kemampuan karakter:

| Karakter | Penalty Jika Mengancam Pemimpin |
|----------|--------------------------------|
| Assassin (Adjacent) | -4,000 |
| Illusionniste | -3,000 |
| Lance-Grappin | -2,500 |
| Manipulatrice | -2,500 |
| Cogneur | -2,000 |
| Rodeuse | -1,500 |
| Cavalier | -1,200 |
| Acrobate | -1,200 |

---

## Sistem Bobot Karakter (Character Weights)

### Tier System

AI mengkategorikan karakter berdasarkan kekuatan:

#### **Tier S** - Win Conditions (90-100)
| Karakter | Nilai | Alasan |
|----------|-------|--------|
| Assassin | 100 | Ancaman capture langsung |
| Archere | 95 | Kontrol zona jarak jauh |
| Nemesis | 90 | Pergerakan tidak terduga |

#### **Tier A** - High Control/Defense (82-88)
| Karakter | Nilai | Alasan |
|----------|-------|--------|
| Geolier | 88 | Menonaktifkan kemampuan musuh |
| Garde Royal | 85 | Mobilitas + perlindungan pemimpin |
| Lance-Grappin | 82 | Displacement yang sangat disruptif |

#### **Tier B** - Value & Mobility (55-75)
| Karakter | Nilai | Alasan |
|----------|-------|--------|
| Cogneur | 75 | Displacement push |
| Illusionniste | 70 | Swap posisi berisiko tinggi |
| Acrobate | 68 | Mobilitas tinggi |
| Vieil Ours | 55 | Nilai standar |

#### **Tier C** - Situational (55-60)
| Karakter | Nilai | Alasan |
|----------|-------|--------|
| Vizir | 60 | Buff mobilitas pemimpin |
| Manipulatrice | 58 | Setup yang sulit |
| Rodeuse | 55 | Teleportasi |

#### **Tier D** - Low Priority (35-45)
| Karakter | Nilai | Alasan |
|----------|-------|--------|
| Cavalier | 45 | Pergerakan linear |
| Tavernier | 40 | Terlalu pasif |
| Protecteur | 35 | Hanya berguna sebagai counter |

### Dynamic Weight Adjustment

Nilai karakter disesuaikan secara dinamis berdasarkan:

1. **Kondisi Pemimpin**: Jika pemimpin dalam bahaya, nilai karakter defensif meningkat
2. **Komposisi Musuh**: Protecteur naik nilainya jika musuh memiliki displacement
3. **Kepadatan Papan**: Karakter mobile lebih berharga di papan yang padat
4. **Duplikasi**: Nilai berkurang jika sudah memiliki karakter yang sama

---

## Tactical Scan - Forced Lines Detection

### Tujuan
Mendeteksi garis paksa (forced lines) sebelum menjalankan Minimax penuh untuk menghemat waktu komputasi.

### Budget System
```
FORCED_SCAN_TOTAL_BUDGET_MS = 18ms   // Total waktu maksimal
FORCED_SCAN_PER_CALL_BUDGET_MS = 10ms  // Per operasi
FORCED_SCAN_MAX_CHECKS = 24  // Maksimal langkah yang dicek
```

### Urutan Deteksi

1. **Mate-in-1 Detection**
   - Mencari langkah yang langsung memenangkan permainan
   - Jika ditemukan, langsung dieksekusi tanpa Minimax

2. **Defense Against Mate-in-1**
   - Jika musuh memiliki ancaman checkmate, cari langkah pertahanan terbaik
   - Menggunakan evaluasi Minimax untuk memilih di antara langkah aman

3. **Mate-in-2 Detection**
   - Mencari langkah yang memaksa kemenangan dalam 2 ply
   - AI mencoba langkah → cek semua respons musuh → pastikan ada kemenangan setelahnya

---

## Move Ordering Heuristic

### Tujuan
Mengurutkan langkah untuk meningkatkan efektivitas Alpha-Beta Pruning.

### Kriteria Pengurutan

```javascript
scoreMoveHeuristic(move):
    score = 0
    
    // Prioritas jenis aksi
    if move.type == 'USE_ABILITY': score += 3
    else if move.type == 'MOVE_UNIT': score += 2
    else if move.type == 'MOVE_LEADER': score += 1
    
    // Mendekati pemimpin musuh = prioritas tinggi
    distance_reduction = before_distance - after_distance
    score += distance_reduction * 4
    
    // Random jitter untuk variasi
    score += random(0, 0.01)
    
    return score
```

### Manhattan Distance
Digunakan untuk kalkulasi jarak:
```
distance = |col_A - col_B| + |row_A - row_B|
```

---

## Threat Assessment System

### Checkmate Detection

AI memiliki sistem deteksi ancaman checkmate dengan level:

| Level | Status | Kondisi |
|-------|--------|---------|
| 0 | Safe | Tidak ada ancaman |
| 1 | Warning | Mobilitas rendah atau beberapa ancaman mendekat |
| 2 | Danger | Sedikit ruang kabur + rute dikuasai musuh |
| 3 | Critical | Hampir dikepung, hanya 1 atau 0 jalan keluar |

### Threat Counting

```javascript
countThreatsToNode(targetNode, threatPlayer):
    - Hitung unit yang bisa mencapai target dalam 1 langkah
    - Pertimbangkan kemampuan khusus (Acrobate jump, Cavalier dash)
    - Untuk 2 langkah, berikan bobot 0.5
```

### High Threat Abilities
```javascript
HIGH_THREAT_ABILITIES = ['assassin', 'lancegrappin', 'manipulatrice', 'illusionniste', 'cogneur']
MOBILE_ABILITIES = ['cavalier', 'acrobate', 'rodeuse', 'garderoyal']
PASSIVE_THREAT_ABILITIES = ['geolier', 'archere', 'nemesis']
```

---

## Counter-Pick & Synergy Analysis

### Counter-Pick Bonus

AI menganalisis komposisi musuh untuk memilih karakter yang tepat:

| Counter | Target | Bonus |
|---------|--------|-------|
| Geolier | Setiap karakter dengan kemampuan aktif | +12 per karakter |
| Protecteur | Displacement (Cogneur, Lance-Grappin, dll) | +18 per karakter |
| Mobile Units | Setup pasif (Protecteur, Tavernier) | +8 per karakter |

### Counter Penalty

| Karakter | Kondisi | Penalty |
|----------|---------|---------|
| Assassin | Musuh punya Geolier | -30 |
| Assassin | Musuh punya Protecteur | -10 |
| Displacement Units | Musuh punya Protecteur | -15 |
| Illusionniste | Musuh punya Geolier | -20 |

### Synergy Bonus

AI mencari kombinasi yang saling mendukung:

| Kombinasi | Bonus | Alasan |
|-----------|-------|--------|
| Illusionniste + Assassin | +25 | Swap assassin ke posisi kill |
| Tavernier + Assassin | +20 | Reposisi untuk serangan |
| Lance-Grappin + Cogneur | +15 | Displacement combo |
| Geolier + Garde Royal | +12 | Strong lockdown |
| Vizir + Garde Royal | +15 | Pemimpin bisa kabur |

### Anti-Synergy

| Kombinasi | Penalty | Alasan |
|-----------|---------|--------|
| Assassin + Archere | -22 | Strategi yang mudah di-counter |

---

## Strategic Placement System

### Unit Classification

```javascript
OFFENSIVE_UNITS = ['assassin', 'lancegrappin', 'cogneur', 'acrobate', 'cavalier', 'archere']
DEFENSIVE_UNITS = ['garderoyal', 'protecteur', 'geolier', 'vizir']
MOBILE_UNITS = ['acrobate', 'cavalier', 'rodeuse', 'garderoyal']
CONTROL_UNITS = ['manipulatrice', 'illusionniste', 'tavernier', 'cogneur', 'lancegrappin']
```

### Placement Scoring

AI mengevaluasi posisi penempatan berdasarkan:

#### Offensive Units
- Lebih dekat ke pemimpin musuh = skor lebih tinggi
- Assassin: Bonus besar jika dalam jarak serang (≤3 atau ≤5)
- Archere: Bonus jika sejajar kolom/baris dengan musuh

#### Defensive Units
- Lebih dekat ke pemimpin sendiri = skor lebih tinggi
- Adjacent ke pemimpin: +60 poin
- Garde Royal: Bonus optimal di jarak 1-2 dari pemimpin

#### Control Units
- Lebih banyak node adjacent = lebih baik
- Illusionniste: Bonus untuk setiap unit nearby (ally/enemy)
- Tavernier: Bonus untuk setiap ally nearby

#### Special Cases
- Nemesis: Hindari terlalu dekat pemimpin sendiri, dekati musuh
- Ourson: Prioritas blocking di sekitar pemimpin

---

## Nemesis Move Selection

### Fitur Khusus
Nemesis memiliki kemampuan unik yang bereaksi terhadap langkah musuh. AI memiliki helper khusus untuk menentukan destinasi terbaik.

### Algoritma

```javascript
chooseNemesisMove(state, ownerKey, originId, destinationIds):
    bestDest = null
    bestScore = -INFINITY
    
    for each dest in destinationIds:
        // Simulasi perpindahan
        nextState = moveNemesisTo(dest)
        
        // Evaluasi dari perspektif pemilik Nemesis
        score = evaluateState(nextState, ownerKey)
        
        if score > bestScore:
            bestScore = score
            bestDest = dest
        else if score == bestScore:
            // Tiebreaker: lebih jauh dari pemimpin sendiri
            if distance(dest, ownLeader) > distance(bestDest, ownLeader):
                bestDest = dest
    
    return bestDest
```

---

## Performa & Optimisasi

### Time Management
- Total waktu per keputusan: Diukur dan dilaporkan via console
- Forced scan budget: 18ms maksimal sebelum fallback ke Minimax
- Heavy evaluation hanya di ply dekat root (≤2) untuk hemat waktu

### Memory Efficiency
- Node map di-cache sekali untuk lookup O(1)
- State di-clone secara shallow untuk setiap simulasi

### Logging
AI melaporkan keputusannya untuk debugging:
```
AI Recruitment: 5.23ms | Best: assassin (125)
AI Thought Time: 45.12ms | Score: 1523 | Move: {...}
AI Forced Line: mate-in-1 found in 2.15ms | Move: {...}
```

---

## Kesimpulan

AI dalam game ini menggunakan kombinasi teknik klasik game AI (Minimax, Alpha-Beta Pruning) dengan knowledge engineering modern (dynamic weights, threat assessment, synergy analysis) untuk menciptakan lawan yang cerdas dan menantang. Sistem ini dirancang untuk:

1. **Responsif** - Keputusan dalam hitungan milidetik
2. **Strategis** - Mempertimbangkan jangka pendek dan panjang
3. **Adaptif** - Menyesuaikan dengan komposisi dan situasi permainan
4. **Taktis** - Mendeteksi ancaman dan peluang checkmate

---

*Dokumen ini dibuat untuk keperluan dokumentasi teknis AI dalam game.*
