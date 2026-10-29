# Expo Router et routes protégées avec l’auth Nutritual

## Conclusion

Pour Expo Router, le modèle recommandé est un état d’authentification exposé par un provider React, puis des gardes `Stack.Protected` dans le layout du navigateur. Expo retire automatiquement l’historique des écrans qui deviennent interdits. Le guide garde le splash visible pendant la restauration de session. Cela masque le chargement, sans garantir la conservation de la destination d’un deep link protégé. [Guide Expo](https://docs.expo.dev/router/advanced/authentication/), [routes protégées](https://docs.expo.dev/router/advanced/protected/)

L’installation mobile utilise Expo SDK 58 (`expo ~58.0.19`, `expo-router ~58.0.26`). La documentation officielle disponible confirme que `redirectTo` est disponible à partir du SDK 58. Les pages versionnées `v58.0.0` n’ont pas été accessibles par le lecteur de documentation pendant cette recherche; les références Expo ci-dessous sont les pages officielles actuelles. Le détail `redirectTo` est corroboré par la mention explicite de SDK 58 dans cette page, mais la vérification directe du tag versionné reste à faire si l’on doit s’appuyer strictement sur le contenu archivé de la version.

## Recommandations Expo

- Un provider d’authentification global expose la session, l’état de chargement/restauration et les opérations de connexion/déconnexion. Le layout racine enveloppe le navigateur avec ce provider. [Guide Expo, contexte d’authentification et layout racine](https://docs.expo.dev/router/advanced/authentication/)
- Les routes authentifiées et publiques sont déclarées une seule fois dans `Stack.Protected`. Quand le garde devient faux, Expo redirige vers une route autorisée et enlève les entrées devenues interdites de l’historique. [Routes protégées Expo](https://docs.expo.dev/router/advanced/protected/)
- Pour une connexion restaurée de façon asynchrone, Expo recommande de garder l’écran de lancement visible jusqu’à la fin du chargement de l’état de session. Son exemple monte le navigateur sous ce splash. [Guide Expo, contrôleur du splash screen](https://docs.expo.dev/router/advanced/authentication/)
- `Stack.Protected redirectTo` est documenté comme disponible en SDK 58+. Il permet d’indiquer la destination de repli au garde, au lieu de dépendre de la route d’ancrage ou du premier écran accessible. [Routes protégées Expo](https://docs.expo.dev/router/advanced/protected/)
- Les gardes sont une restriction de navigation côté client. Ils ne remplacent pas l’autorisation côté serveur/API. [Routes protégées Expo, considérations SSR](https://docs.expo.dev/router/advanced/protected/)

## Better Auth: quand l’utiliser

La documentation Better Auth Expo concerne l’intégration d’un client Better Auth dans une application native: plugin Expo côté serveur, `expoClient` côté app, stockage sécurisé des cookies/session et deep links OAuth. Cette intégration est pertinente si l’application authentifie directement ses utilisateurs par Better Auth et consomme sa session. [Better Auth, intégration Expo](https://better-auth.com/docs/integrations/expo)

Elle n’est pas nécessaire pour appliquer `Stack.Protected`: Expo ne lie pas les gardes à un fournisseur précis, uniquement à un booléen d’état d’authentification exposé par l’application. Une session OAuth/OIDC déjà gérée par le code mobile peut nourrir ce garde. Remplacer ce mécanisme par un client Better Auth changerait le modèle de session mobile, pas nécessairement le fournisseur Neon. [Guide Expo, provider personnalisable](https://docs.expo.dev/router/advanced/authentication/), [Better Auth Expo](https://better-auth.com/docs/integrations/expo)

Neon Managed Auth est fondé sur Better Auth. Le plugin Expo Better Auth peut donc être une option si l’app mobile veut consommer directement une session Better Auth. La documentation Neon consultée décrit ses SDK et guides web, mais ne donne pas d’exemple Expo natif. Il n’y a donc pas de preuve ici qu’une migration vers ce client soit nécessaire ou compatible avec le flux OAuth/OIDC mobile déjà en place. [Neon Managed Auth](https://neon.com/docs/auth/about), [SDK Neon Auth](https://neon.com/docs/reference/javascript-sdk), [Better Auth Expo](https://better-auth.com/docs/integrations/expo)

## Application au code de cette branche

Le `Stack.Protected` dans le layout racine est donc un choix conforme au modèle Expo; le fait d’avoir la logique de garde à cet endroit n’est pas en soi une erreur. Les points à examiner dans la refactorisation sont plutôt la séparation des responsabilités et la stabilité de l’arbre de navigation: le provider doit terminer la restauration avant que la garde choisisse l’écran, et les providers de fonctionnalités authentifiées ne devraient pas forcer le remplacement du navigateur si le garde peut simplement conditionner le groupe authentifié.

L’architecture recommandée à comparer avec le code existant est:

1. Provider d’auth dans le layout racine.
2. Un composant navigateur enfant qui lit le contexte d’auth.
3. `Stack.Protected` avec une garde pour les routes authentifiées et une pour la connexion, avec des destinations explicites si nécessaire.
4. Un layout de groupe authentifié pour les providers qui ne concernent que ces écrans.

Cette note ne prétend pas que Better Auth doit être ajouté ni que le flux d’auth actuel doit changer.

## Diagnostic et périmètre proposé

- `apps/mobile/src/app/_layout.tsx:110-132` utilise déjà les gardes recommandés. `redirectTo` est aussi présent dans les types installés, `apps/mobile/node_modules/expo-router/build/views/Protected.d.ts:3-7`.
- À la ligne 138, le même emplacement passe de `Stack` à `RoutinesProvider > Stack`. Cela remonte le navigateur lors des transitions d’authentification. C’est une conséquence de la règle React sur le changement de type à un même emplacement, pas un bug de navigation reproduit sur appareil. [React, conservation et réinitialisation de l’état](https://react.dev/learn/preserving-and-resetting-state)
- Déplacer les routes privées sous `src/app/(app)/`, avec `RoutinesProvider` et leur stack dans le layout du groupe. Garder un stack racine stable protégeant le groupe, et garder `sign-in` hors du groupe. Les parenthèses ne changent pas les URL. [Expo, groupes de routes](https://docs.expo.dev/router/basics/notation/), [guide d’authentification](https://docs.expo.dev/router/advanced/authentication/)
- Déplacer le calcul du statut et son suivi d’expiration dans `features/auth/AuthProvider.tsx`. Extraire les effets d’appairage vers un hook de cette feature en conservant `pending-pair-link.ts`. Remplacer la route `auth-loading` et son écran par le contrôleur de splash du guide. Ce sont des choix d’organisation pour respecter les responsabilités du dépôt.
- Conserver le flux Neon OAuth avec PKCE décrit dans `docs/adr/0003-use-neon-managed-auth.md`. Renforcer les tests existants de session et d’appairage, puis vérifier démarrage, connexion, déconnexion, expiration et reprise du lien `/pair`. Les tests de coordinateur couvrent déjà la priorité du dernier QR sur un lien initial tardif, mais pas le montage du navigateur. Aucune vérification sur appareil n’a été réalisée.
