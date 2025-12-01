// Test de connexion à Back4App
// Ce script vérifie que la configuration Parse est correcte

const Parse = require('parse/node');

// Configuration
Parse.initialize(
    'kJIx0REXZJo3a4WA91EqKKjHvav6LgGusv94cyxF', // Application ID
    '3NsaHXkgyehFtgauTCkqHAD8O2Vh2cb5QvlRZPuE'  // JavaScript Key
);
Parse.serverURL = 'https://parseapi.back4app.com';

async function testConnection() {
    console.log('🔍 Test de connexion à Back4App...\n');

    try {
        // Test 1: Connexion au serveur
        console.log('✓ Configuration Parse initialisée');
        console.log(`  - App ID: kJIx0REX...`);
        console.log(`  - Server: ${Parse.serverURL}\n`);

        // Test 2: Vérifier la connexion en listant les classes
        console.log('📋 Tentative de connexion au serveur...');
        const TestObject = Parse.Object.extend('_User');
        const query = new Parse.Query(TestObject);
        query.limit(1);

        await query.find();
        console.log('✅ Connexion réussie !\n');

        // Test 3: Vérifier les classes existantes
        console.log('📊 Classes disponibles:');
        const schema = new Parse.Schema('_User');
        const userSchema = await schema.get();
        console.log('  ✓ User (classe par défaut)\n');

        console.log('🎉 Configuration Back4App validée avec succès !\n');
        console.log('Prochaines étapes:');
        console.log('1. Créez les classes dans le dashboard Back4App');
        console.log('2. Ajoutez les Cloud Functions');
        console.log('3. Créez le premier utilisateur admin');
        console.log('4. Lancez l\'application avec: npm run dev\n');
        console.log('Consultez QUICK_START.md pour les instructions détaillées.');

    } catch (error) {
        console.error('❌ Erreur de connexion:', error.message);
        console.log('\n⚠️  Vérifications:');
        console.log('1. Les clés dans .env.local sont correctes');
        console.log('2. Votre application Back4App est active');
        console.log('3. Vous avez une connexion internet');
    }
}

testConnection();
