/**
 * DIAGNOSTIC E-ARCHIVE PMN — Script de LECTURE SEULE
 *
 * Objectif : comprendre pourquoi les dossiers s'affichent "vides" alors que
 * le tableau de bord annonce ~3894 documents, et prouver que les documents
 * ne sont PAS perdus.
 *
 * GARANTIES :
 *   - Aucune écriture : uniquement count() / find() / first().
 *   - Aucun save/destroy/Cloud.run mutatif.
 *   - Écrit uniquement le rapport local diagnostic-report.txt.
 *
 * Usage : node diagnostic-archive.js
 *
 * Connexion : même pattern que investigate-folders.js (.env.local).
 * PARSE_MASTER_KEY est optionnelle : si absente, le script tourne en mode
 * "client uniquement" et l'indique clairement dans le rapport.
 */

const Parse = require('parse/node');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const HAS_MK = !!process.env.PARSE_MASTER_KEY;

// Initialize Parse (pattern identique aux scripts existants)
Parse.initialize(
    process.env.NEXT_PUBLIC_PARSE_APP_ID,
    process.env.NEXT_PUBLIC_PARSE_JS_KEY,
    process.env.PARSE_MASTER_KEY // undefined si absente — géré via HAS_MK
);
Parse.serverURL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

// Options de requête : Master Key si disponible, sinon clé JS client
const MK = HAS_MK ? { useMasterKey: true } : {};
const MK_LABEL = HAS_MK ? 'Master Key' : 'clé JS client (PARSE_MASTER_KEY absente de .env.local)';

// ---------------------------------------------------------------------------
// Journalisation : console + fichier
// ---------------------------------------------------------------------------
const REPORT_FILE = 'diagnostic-report.txt';
const lines = [];
function log(msg = '') {
    console.log(msg);
    lines.push(msg);
}
function flushReport() {
    fs.writeFileSync(REPORT_FILE, lines.join('\n') + '\n', 'utf8');
}

function fmtErr(e) {
    if (!e) return 'aucune';
    const code = e.code !== undefined ? `code ${e.code}` : 'code ?';
    return `${code} — ${e.message || String(e)}`;
}

// ---------------------------------------------------------------------------
// Blocs de diagnostic
// ---------------------------------------------------------------------------

// Résultats partagés entre blocs pour le verdict final
const R = {
    docCount: null,
    folderCount: null,
    visibleFolders: [],       // { name, objectId, folderNumber, docCount }
    integrity: null,           // { scanned, noFolderId, valid, orphans, orphanUuid36, orphanExamples, complete }
    bigFind: {},               // { docMK, docClient, folderMK, folderClient } → { count, ms, error }
    permTest: null,            // { folderName, withMK, withoutMK }
};

async function blocA() {
    log('════════════════════════════════════════════════════════════');
    log('BLOC A — Comptages globaux (' + MK_LABEL + ')');
    log('════════════════════════════════════════════════════════════');
    try {
        R.docCount = await new Parse.Query('Document').count(MK);
        log(`  Documents (count) : ${R.docCount}`);
    } catch (e) {
        log(`  ❌ count(Document) : ${fmtErr(e)}`);
    }
    try {
        R.folderCount = await new Parse.Query('Folder').count(MK);
        log(`  Folders   (count) : ${R.folderCount}`);
    } catch (e) {
        log(`  ❌ count(Folder) : ${fmtErr(e)}`);
    }
    if (R.docCount !== null) {
        log(`  → Comparaison au tableau de bord (3894) : ${R.docCount === 3894 ? 'IDENTIQUE' : 'différent (' + R.docCount + ')'}`);
    }
    log('');
}

const VISIBLE_FOLDER_NAMES = [
    'Archives',
    '108 FERMON',
    '2016 formation',
    '2017 ACQUISITION AGENDA',
    '2017 ACQUISITION MOBILIER',
    '2017 DRP FOURNITURE BUREAU',
];

async function blocB() {
    log('════════════════════════════════════════════════════════════');
    log('BLOC B — Les dossiers "vides" à l\'écran contiennent-ils des documents ? (test décisif H1 vs H2)');
    log('════════════════════════════════════════════════════════════');
    for (const name of VISIBLE_FOLDER_NAMES) {
        try {
            const fq = new Parse.Query('Folder');
            fq.equalTo('name', name);
            fq.limit(10);
            const matches = await fq.find(MK);

            if (matches.length === 0) {
                log(`  ⚠️  "${name}" : AUCUN dossier de ce nom trouvé en base`);
                R.visibleFolders.push({ name, objectId: null, folderNumber: null, docCount: null });
                continue;
            }
            if (matches.length > 1) {
                log(`  ⚠️  "${name}" : ${matches.length} dossiers homonymes — chacun est analysé :`);
            }
            for (const folder of matches) {
                let docCount = null, err = null;
                try {
                    const dq = new Parse.Query('Document');
                    dq.equalTo('folder_id', folder.id);
                    docCount = await dq.count(MK);
                } catch (e) { err = e; }

                const num = folder.get('folder_number') || '?';
                log(`  📁 "${name}" (${num}, objId ${folder.id}) : ` +
                    (err ? `❌ erreur count → ${fmtErr(err)}` : `${docCount} document(s) en base`));
                R.visibleFolders.push({ name, objectId: folder.id, folderNumber: num, docCount });
            }
        } catch (e) {
            log(`  ❌ "${name}" : erreur de recherche du dossier → ${fmtErr(e)}`);
            R.visibleFolders.push({ name, objectId: null, folderNumber: null, docCount: null });
        }
    }
    log('');
    log('  Interprétation :');
    log('   - Documents présents en base mais UI "vide"  → H1 (problème de chargement, données intactes)');
    log('   - Réellement 0 document dans ces dossiers    → creuser H2 (orphelins / documents ailleurs)');
    log('');
}

async function blocC() {
    log('════════════════════════════════════════════════════════════');
    log('BLOC C — Intégrité des folder_id (test H2) — pagination par 1000');
    log('════════════════════════════════════════════════════════════');
    const res = {
        scanned: 0, noFolderId: 0, valid: 0, orphans: 0,
        orphanUuid36: 0, len10: 0, len36: 0, lenOther: 0,
        orphanExamples: [], complete: false,
    };
    try {
        // 1) Tous les Folder.objectId dans un Set (paginé)
        const folderIds = new Set();
        let skip = 0;
        for (;;) {
            const fq = new Parse.Query('Folder');
            fq.limit(1000);
            fq.skip(skip);
            fq.ascending('objectId'); // ordre stable pour la pagination
            const page = await fq.find(MK);
            page.forEach(f => folderIds.add(f.id));
            if (page.length < 1000) break;
            skip += 1000;
        }
        log(`  Folders chargés dans le Set : ${folderIds.size}`);

        // 2) Tous les Document par pages de 1000, champ folder_id uniquement
        skip = 0;
        for (;;) {
            const dq = new Parse.Query('Document');
            dq.select('folder_id');
            dq.limit(1000);
            dq.skip(skip);
            dq.ascending('objectId');
            const page = await dq.find(MK);

            for (const doc of page) {
                res.scanned++;
                const fid = doc.get('folder_id');
                if (!fid) { res.noFolderId++; continue; }
                // format
                if (fid.length === 10) res.len10++;
                else if (fid.length === 36) res.len36++;
                else res.lenOther++;
                // validité
                if (folderIds.has(fid)) {
                    res.valid++;
                } else {
                    res.orphans++;
                    if (fid.length === 36) res.orphanUuid36++;
                    if (res.orphanExamples.length < 5) {
                        res.orphanExamples.push(`${fid} (doc ${doc.id})`);
                    }
                }
            }
            if (page.length < 1000) break;
            skip += 1000;
        }
        res.complete = true;

        log(`  Documents parcourus  : ${res.scanned}${R.docCount !== null && res.scanned < R.docCount ? `  ⚠️ INCOMPLET (count total = ${R.docCount})` : ''}`);
        log(`  Sans folder_id       : ${res.noFolderId}`);
        log(`  folder_id VALIDE     : ${res.valid}`);
        log(`  folder_id ORPHELIN   : ${res.orphans}  (dont format UUID 36c : ${res.orphanUuid36})`);
        log(`  Formats folder_id    : 10c (Parse) = ${res.len10} | 36c (UUID Supabase) = ${res.len36} | autre = ${res.lenOther}`);
        if (res.orphanExamples.length) {
            log(`  Exemples d'orphelins :`);
            res.orphanExamples.forEach(x => log(`    - ${x}`));
        }
    } catch (e) {
        log(`  ❌ Bloc C interrompu : ${fmtErr(e)}`);
        log(`  (Résultats partiels : ${res.scanned} documents parcourus)`);
    }
    R.integrity = res;
    log('');
}

async function timedFind(className, useMK) {
    const out = { count: null, ms: null, error: null };
    const t0 = Date.now();
    try {
        const q = new Parse.Query(className);
        q.limit(5000);
        const results = await q.find(useMK ? { useMasterKey: true } : {});
        out.ms = Date.now() - t0;
        out.count = results.length;
    } catch (e) {
        out.ms = Date.now() - t0;
        out.error = fmtErr(e);
    }
    return out;
}

async function blocD() {
    log('════════════════════════════════════════════════════════════');
    log('BLOC D — Reproduction du chargement massif de la page (test H1)');
    log('════════════════════════════════════════════════════════════');

    if (HAS_MK) {
        R.bigFind.docMK = await timedFind('Document', true);
        log(`  Document find(limit 5000) AVEC Master Key : ${R.bigFind.docMK.count ?? '—'} objets en ${R.bigFind.docMK.ms} ms | erreur: ${R.bigFind.docMK.error || 'aucune'}`);
    } else {
        log('  Document find(limit 5000) AVEC Master Key : ⏭️  ignoré (PARSE_MASTER_KEY absente)');
    }
    R.bigFind.docClient = await timedFind('Document', false);
    log(`  Document find(limit 5000) SANS Master Key : ${R.bigFind.docClient.count ?? '—'} objets en ${R.bigFind.docClient.ms} ms | erreur: ${R.bigFind.docClient.error || 'aucune'}`);

    if (HAS_MK) {
        R.bigFind.folderMK = await timedFind('Folder', true);
        log(`  Folder   find(limit 5000) AVEC Master Key : ${R.bigFind.folderMK.count ?? '—'} objets en ${R.bigFind.folderMK.ms} ms | erreur: ${R.bigFind.folderMK.error || 'aucune'}`);
    } else {
        log('  Folder   find(limit 5000) AVEC Master Key : ⏭️  ignoré (PARSE_MASTER_KEY absente)');
    }
    R.bigFind.folderClient = await timedFind('Folder', false);
    log(`  Folder   find(limit 5000) SANS Master Key : ${R.bigFind.folderClient.count ?? '—'} objets en ${R.bigFind.folderClient.ms} ms | erreur: ${R.bigFind.folderClient.error || 'aucune'}`);

    log('');
    log('  Interprétation : si le find() massif échoue ou renvoie beaucoup moins que le count(),');
    log('  H1 est confirmée ; le message d\'erreur précise la cause (limite, timeout, CLP).');
    log('');
}

async function blocE() {
    log('════════════════════════════════════════════════════════════');
    log('BLOC E — Permission client vs serveur (CLP/ACL) sur 1 dossier');
    log('════════════════════════════════════════════════════════════');
    if (!HAS_MK) {
        log('  ⏭️  Test impossible sans PARSE_MASTER_KEY (il compare Master Key vs clé client).');
        log('     → Ajouter PARSE_MASTER_KEY dans .env.local puis relancer pour ce test.');
        log('');
        return;
    }
    const target = R.visibleFolders.find(f => f.objectId && f.docCount > 0);
    if (!target) {
        log('  ⏭️  Aucun dossier non vide identifié au Bloc B — test sans objet.');
        log('');
        return;
    }
    const res = { folderName: target.name, withMK: null, withoutMK: null, errMK: null, errClient: null };
    try {
        const q1 = new Parse.Query('Document');
        q1.equalTo('folder_id', target.objectId);
        res.withMK = await q1.count({ useMasterKey: true });
    } catch (e) { res.errMK = fmtErr(e); }
    try {
        const q2 = new Parse.Query('Document');
        q2.equalTo('folder_id', target.objectId);
        res.withoutMK = await q2.count();
    } catch (e) { res.errClient = fmtErr(e); }

    log(`  Dossier testé : "${target.name}" (objId ${target.objectId})`);
    log(`  Avec Master Key : ${res.withMK ?? '—'} docs ${res.errMK ? '| erreur: ' + res.errMK : ''}`);
    log(`  Sans Master Key : ${res.withoutMK ?? '—'} docs ${res.errClient ? '| erreur: ' + res.errClient : ''}`);
    if (res.withMK !== null && res.withoutMK !== null && res.withMK > res.withoutMK) {
        log('  ⚠️  Master Key > clé client → des CLP/ACL masquent des documents au client.');
    }
    R.permTest = res;
    log('');
}

// ---------------------------------------------------------------------------
// Synthèse finale
// ---------------------------------------------------------------------------
function synthese() {
    log('════════════════════════════════════════════════════════════');
    log('===== DIAGNOSTIC E-ARCHIVE PMN =====');
    log('════════════════════════════════════════════════════════════');
    log(`Mode de connexion        : ${MK_LABEL}`);
    log(`Documents (count)        : ${R.docCount ?? 'ÉCHEC'}`);
    log(`Folders (count)          : ${R.folderCount ?? 'ÉCHEC'}`);
    log('');
    log('--- Dossiers visibles ---');
    for (const f of R.visibleFolders) {
        if (!f.objectId) {
            log(`${f.name.padEnd(28)}: introuvable en base`);
        } else {
            log(`${f.name.padEnd(28)}(${f.folderNumber}, objId ${f.objectId}) : ${f.docCount ?? 'erreur'} documents en base`);
        }
    }
    log('');
    if (R.integrity) {
        const i = R.integrity;
        log('--- Intégrité folder_id ---');
        log(`Documents parcourus       : ${i.scanned}${i.complete ? '' : '  (INCOMPLET)'}`);
        log(`Sans folder_id            : ${i.noFolderId}`);
        log(`folder_id valide          : ${i.valid}`);
        log(`folder_id ORPHELIN        : ${i.orphans}  (dont format UUID 36c : ${i.orphanUuid36})`);
        log(`Exemples d'orphelins      : ${i.orphanExamples.length ? i.orphanExamples.join(' | ') : 'aucun'}`);
        log('');
    }
    log('--- Reproduction chargement ---');
    const bf = R.bigFind;
    const fmt = (r, label) => r
        ? `${label} : ${r.count ?? '—'} objets en ${r.ms} ms | erreur: ${r.error || 'aucune'}`
        : `${label} : non exécuté`;
    log(fmt(bf.docMK, 'Document find(5000) MK    '));
    log(fmt(bf.docClient, 'Document find(5000) client'));
    log(fmt(bf.folderMK, 'Folder   find(5000) MK    '));
    log(fmt(bf.folderClient, 'Folder   find(5000) client'));
    log('');
    log('--- Test permission (1 dossier) ---');
    if (R.permTest) {
        log(`Dossier "${R.permTest.folderName}" — Avec Master Key : ${R.permTest.withMK ?? '—'} docs | Sans Master Key : ${R.permTest.withoutMK ?? '—'} docs`);
    } else {
        log(HAS_MK ? 'Non exécuté (aucun dossier non vide trouvé)' : 'Non exécuté (PARSE_MASTER_KEY absente)');
    }
    log('');
    log('--- VERDICT ---');

    // Verdict automatisé, prudent
    const verdicts = [];

    const visibleWithDocs = R.visibleFolders.filter(f => (f.docCount ?? 0) > 0).length;
    const visibleEmpty = R.visibleFolders.filter(f => f.objectId && f.docCount === 0).length;

    if (visibleWithDocs > 0) {
        verdicts.push(`✅ Les documents NE SONT PAS PERDUS : ${visibleWithDocs} des dossiers affichés "vides" contiennent bien des documents en base → H1 (problème de chargement côté UI).`);
    } else if (visibleEmpty > 0 && R.integrity && R.integrity.orphans > 0) {
        verdicts.push(`Les dossiers testés sont réellement vides en base ET ${R.integrity.orphans} documents ont un folder_id orphelin → H2 (documents rattachés à des IDs de dossiers inexistants, probable séquelle de migration).`);
    }

    if (R.integrity && R.integrity.orphans > 0) {
        verdicts.push(`⚠️ H2 également présente : ${R.integrity.orphans}/${R.integrity.scanned} documents orphelins (dont ${R.integrity.orphanUuid36} avec folder_id au format UUID Supabase 36c).`);
    } else if (R.integrity && R.integrity.complete && R.integrity.orphans === 0) {
        verdicts.push('✅ H2 écartée : aucun folder_id orphelin détecté.');
    }

    const clientErr = (bf.docClient && bf.docClient.error) || (bf.folderClient && bf.folderClient.error);
    if (clientErr) {
        verdicts.push(`⚠️ Le find() massif côté client ÉCHOUE (${clientErr}) alors que count() réussit → cause directe des toasts "Erreur lors du chargement" → H1 confirmée.`);
    } else if (bf.docClient && R.docCount !== null && bf.docClient.count !== null && bf.docClient.count < Math.min(R.docCount, 5000)) {
        verdicts.push(`⚠️ Le find() client renvoie ${bf.docClient.count} objets sur ${R.docCount} attendus → résultats tronqués (limite ou CLP/ACL) → H1/CLP.`);
    }

    if (R.permTest && R.permTest.withMK !== null && R.permTest.withoutMK !== null && R.permTest.withMK > R.permTest.withoutMK) {
        verdicts.push('⚠️ CLP/ACL : la Master Key voit plus de documents que la clé client → des permissions masquent des données à l\'application.');
    }

    if (verdicts.length === 0) {
        verdicts.push('Résultats non concluants avec les données disponibles — voir les erreurs ci-dessus. Ajouter PARSE_MASTER_KEY et relancer si ce n\'est pas déjà fait.');
    }
    verdicts.forEach(v => log(v));
    if (!HAS_MK) {
        log('');
        log('ℹ️  Ce diagnostic a tourné SANS Master Key : les chiffres reflètent ce que voit la clé client.');
        log('   Pour la vérité absolue en base (et le test CLP du Bloc E), ajouter PARSE_MASTER_KEY');
        log('   dans .env.local (Back4App → App Settings → Security & Keys) et relancer.');
    }
    log('');
    log(`Rapport généré le ${new Date().toISOString()} — script en lecture seule, aucune donnée modifiée.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
    log('🔍 DIAGNOSTIC E-ARCHIVE PMN — lecture seule');
    log(`Serveur : ${Parse.serverURL}`);
    log(`Date    : ${new Date().toISOString()}`);
    log('');

    try {
        await blocA();
        await blocB();
        await blocC();
        await blocD();
        await blocE();
    } catch (e) {
        log(`❌ Erreur inattendue : ${fmtErr(e)}`);
    }

    synthese();
    flushReport();
    console.log(`\n📄 Rapport écrit dans ${REPORT_FILE}`);
    process.exit(0);
})();
