// Script de création du compte super admin
// Email: harouna.sylla@pmn.sn
// Role: super_admin

const Parse = require('parse/node');

// Configuration Back4App
Parse.initialize(
    'kJIx0REXZJo3a4WA91EqKKjHvav6LgGusv94cyxF',
    '3NsaHXkgyehFtgauTCkqHAD8O2Vh2cb5QvlRZPuE'
);
Parse.serverURL = 'https://parseapi.back4app.com';

async function createSuperAdmin() {
    console.log('🔐 Création du compte super admin...\n');

    try {
        // Créer l'utilisateur
        const user = new Parse.User();

        user.set('username', 'harouna.sylla@pmn.sn');
        user.set('email', 'harouna.sylla@pmn.sn');
        user.set('password', 'My@dmin-pmn');
        user.set('full_name', 'Harouna Sylla');
        user.set('role', 'super_admin');
        user.set('department', 'Direction PMN');
        user.set('is_active', true);
        user.set('is_verified', true);

        await user.signUp();

        console.log('✅ Compte super admin créé avec succès !\n');
        console.log('📋 Informations du compte:');
        console.log('   Email: harouna.sylla@pmn.sn');
        console.log('   Mot de passe: My@dmin-pmn');
        console.log('   Rôle: super_admin');
        console.log('   Statut: Actif et vérifié\n');
        console.log('🚀 Vous pouvez maintenant vous connecter à l\'application !');
        console.log('   1. Lancez: npm run dev');
        console.log('   2. Allez sur: http://localhost:3000/login');
        console.log('   3. Connectez-vous avec vos identifiants\n');

    } catch (error) {
        if (error.code === 202) {
            console.log('⚠️  Un compte avec cet email existe déjà.');
            console.log('   Vous pouvez vous connecter directement avec:');
            console.log('   Email: harouna.sylla@pmn.sn');
            console.log('   Mot de passe: My@dmin-pmn\n');
        } else {
            console.error('❌ Erreur lors de la création du compte:', error.message);
            console.log('\n💡 Solutions possibles:');
            console.log('1. Vérifiez que la classe User existe dans Back4App');
            console.log('2. Vérifiez les permissions de la classe User (Public Create)');
            console.log('3. Créez le compte manuellement dans le dashboard Back4App\n');
        }
    }
}

createSuperAdmin();
