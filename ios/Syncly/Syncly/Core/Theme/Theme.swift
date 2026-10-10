import SwiftUI

enum Theme {
    static let background = Color("Background")
    static let surface = Color("Surface")
    static let card = Color("Card")
    static let foreground = Color("Foreground")
    static let secondaryText = Color("SecondaryText")
    static let primary = Color("Primary")
    static let primaryForeground = Color("PrimaryForeground")
    static let accent = Color("Accent")
}

enum AppAppearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
