# Use universal Expo UI components and validate on iOS first

The local routine milestone uses the universal components imported from the
`@expo/ui` package root, including `Host`, `Column`, `Button`, and `Text`. Expo UI
selects SwiftUI on iOS and Jetpack Compose on Android, so both platforms share
the same UI code. This milestone validates the app on iOS only. Android
validation remains outside its scope.

Keep routine rules, persistence, and reminder scheduling separate from the UI
so both platforms can reuse the routine behavior. Use the universal API rather
than importing directly from `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose`.
Do not add separate Android screens, fallbacks, or speculative platform
abstractions. Shared UI support does not establish that the entire app works
on Android. Android reminder behavior and the full user flow still need device
validation when that work is scoped.

The universal root API does not expose a date or time picker in SDK 58. Use the
installed `@expo/ui/community/datetime-picker` wrapper for these two controls.
It selects each platform's native picker without separate application screens.
Bridge it and `expo-symbols` through `RNHostView`. The icon-only close control
uses an accessible React Native `Pressable` through the same bridge because the
universal button does not expose an accessibility label for custom content.
Keep layout, text, forms, lists and other actions on the universal root API.

Reference: [Expo UI universal components](https://docs.expo.dev/versions/latest/sdk/ui/universal/).
