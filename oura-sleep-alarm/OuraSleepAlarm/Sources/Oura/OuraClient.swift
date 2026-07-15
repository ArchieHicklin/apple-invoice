import Foundation

/// A single sleep session from `GET /v2/usercollection/sleep`.
struct OuraSleepSession: Codable, Identifiable {
    let id: String
    /// "long_sleep", "late_nap", "sleep", "deleted", "rest"
    let type: String
    let bedtimeStart: Date?
    let bedtimeEnd: Date?
    /// Seconds from bedtime start to sleep onset.
    let latency: TimeInterval?
    /// Total seconds awake during the session.
    let awakeTime: TimeInterval?
    let totalSleepDuration: TimeInterval?

    enum CodingKeys: String, CodingKey {
        case id, type, latency
        case bedtimeStart = "bedtime_start"
        case bedtimeEnd = "bedtime_end"
        case awakeTime = "awake_time"
        case totalSleepDuration = "total_sleep_duration"
    }
}

private struct OuraCollectionResponse<T: Codable>: Codable {
    let data: [T]
    let nextToken: String?
    enum CodingKeys: String, CodingKey {
        case data
        case nextToken = "next_token"
    }
}

enum OuraError: Error {
    case notConfigured
    case unauthorized
    case http(Int)
}

/// Minimal Oura API v2 client using a Personal Access Token.
///
/// Used only for (a) the nightly stats refresh and (b) the morning feedback
/// pull. Never on the critical alarm path — the alarm works fully offline.
struct OuraClient {
    var tokenProvider: () -> String?
    var session: URLSession = .shared

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// Fetch sleep sessions for the last `days` days (paginated).
    func recentSleepSessions(days: Int = 60) async throws -> [OuraSleepSession] {
        guard let token = tokenProvider(), !token.isEmpty else { throw OuraError.notConfigured }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = .current
        let start = df.string(from: Date().addingTimeInterval(-Double(days) * 86400))
        let end = df.string(from: Date().addingTimeInterval(86400))

        var sessions: [OuraSleepSession] = []
        var nextToken: String? = nil
        repeat {
            var components = URLComponents(string: "https://api.ouraring.com/v2/usercollection/sleep")!
            var items = [
                URLQueryItem(name: "start_date", value: start),
                URLQueryItem(name: "end_date", value: end),
            ]
            if let nextToken { items.append(URLQueryItem(name: "next_token", value: nextToken)) }
            components.queryItems = items

            var request = URLRequest(url: components.url!)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw OuraError.http(-1) }
            if http.statusCode == 401 { throw OuraError.unauthorized }
            guard (200..<300).contains(http.statusCode) else { throw OuraError.http(http.statusCode) }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom { d in
                let container = try d.singleValueContainer()
                let string = try container.decode(String.self)
                if let date = Self.iso.date(from: string) { return date }
                let plain = ISO8601DateFormatter()
                if let date = plain.date(from: string) { return date }
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Bad date: \(string)")
            }
            let page = try decoder.decode(OuraCollectionResponse<OuraSleepSession>.self, from: data)
            sessions.append(contentsOf: page.data)
            nextToken = page.nextToken
        } while nextToken != nil

        return sessions
    }
}
