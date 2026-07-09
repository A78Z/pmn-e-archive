/**
 * BACKFILL DES EMPREINTES — Archive PMN (OPTIONNEL, sûr)
 *
 * Parcourt les Document SANS `file_hash`, télécharge le fichier depuis son
 * `file_path`, calcule le SHA-256 et écrit UNIQUEMENT `file_hash` (+ `file_size`
 * s'il manque). AUCUNE autre écriture, AUCUNE suppression.
 *
 * Propriétés :
 *  - Throttlé (petits lots + pauses) pour ne pas surcharger Back4App.
 *  - Reprenable : chaque itération requête « sans file_hash » → reprend
 *    automatiquement là où il s'est arrêté.
 *  - Journalise l'avancement.
 *
 * ⚠️ OPTIONNEL : sans ce script, la détection fonctionne déjà par empreinte
 * pour les nouveaux uploads et par nom+taille pour l'existant.
 *
 * Usage :
 *   node backfill-file-hash.js            # traite tout, par lots
 *   node backfill-file-hash.js --limit 100  # s'arrête après ~100 documents
 *
 * Nécessite PARSE_MASTER_KEY dans .env.local.
 */

const Parse = require('parse/node');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

Parse.initialize(
    process.env.NEXT_PUBLIC_PARSE_APP_ID,
    process.env.NEXT_PUBLIC_PARSE_JS_KEY,
    process.env.PARSE_MASTER_KEY
);
Parse.serverURL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

const MK = { useMasterKey: true };
const BATCH = 15;                 // documents par lot
const PAUSE_BATCH_MS = 1500;      // pause entre lots
const PAUSE_FILE_MS = 150;        // pause entre fichiers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argLimit = (() => {
    const i = process.argv.indexOf('--limit');
    return i >= 0 ? parseInt(process.argv[i + 1], 10) || Infinity : Infinity;
})();

async function main() {
    if (!process.env.PARSE_MASTER_KEY) {
        console.error('❌ PARSE_MASTER_KEY absente de .env.local — abandon.');
        process.exit(1);
    }

    // Total restant (indicatif)
    const totalQuery = new Parse.Query('Document');
    totalQuery.doesNotExist('file_hash');
    const remaining = await totalQuery.count(MK);
    console.log(`🧬 Backfill des empreintes — ${remaining} document(s) sans file_hash.`);
    console.log(`   Lots de ${BATCH}, limite session: ${argLimit === Infinity ? 'aucune' : argLimit}\n`);

    let processed = 0;
    let hashed = 0;
    let errors = 0;

    for (;;) {
        if (processed >= argLimit) {
            console.log(`\n⏹️  Limite de session atteinte (${argLimit}).`);
            break;
        }

        const query = new Parse.Query('Document');
        query.doesNotExist('file_hash');
        query.exists('file_path');
        query.limit(BATCH);
        query.ascending('createdAt');
        const docs = await query.find(MK);

        if (docs.length === 0) {
            console.log('\n✅ Terminé : plus aucun document sans empreinte.');
            break;
        }

        for (const doc of docs) {
            if (processed >= argLimit) break;
            processed++;
            const name = doc.get('name');
            const url = doc.get('file_path');
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf = Buffer.from(await res.arrayBuffer());
                const hash = crypto.createHash('sha256').update(buf).digest('hex');

                doc.set('file_hash', hash);
                if (typeof doc.get('file_size') !== 'number') {
                    doc.set('file_size', buf.length);
                }
                await doc.save(null, MK);
                hashed++;
                console.log(`  ✓ [${processed}] ${String(name).slice(0, 55)} → ${hash.slice(0, 12)}…`);
            } catch (e) {
                errors++;
                console.warn(`  ✗ [${processed}] ${String(name).slice(0, 55)} — ${e.message}`);
                // On NE marque rien : le document sera re-tenté au prochain passage.
            }
            await sleep(PAUSE_FILE_MS);
        }

        console.log(`   … ${hashed} empreintes écrites, ${errors} erreurs (pause ${PAUSE_BATCH_MS} ms)`);
        await sleep(PAUSE_BATCH_MS);
    }

    console.log(`\n📊 Session : ${processed} traités · ${hashed} empreintes écrites · ${errors} erreurs.`);
    console.log('   Relancez le script pour reprendre / terminer (reprenable).');
    process.exit(0);
}

main().catch((e) => {
    console.error('Erreur fatale:', e.message);
    process.exit(1);
});
