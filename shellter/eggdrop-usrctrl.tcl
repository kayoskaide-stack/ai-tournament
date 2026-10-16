# Brain Trust /usrctrl adapter for Eggdrop.
# Owner-only by Eggdrop global +n flag. One-time access codes are NOTICEd
# privately to the owner and are never written to the channel.
# Required environment variables for the Eggdrop process:
#   BRAINTRUST_PUBLIC_URL=https://ai-tournament-kayoskaide.vercel.app
#   BRAINTRUST_RELAY_TOKEN=<same trusted relay token used by Brain Trust>

namespace eval btusr {
  variable base [string trimright [expr {[info exists ::env(BRAINTRUST_PUBLIC_URL)] ? $::env(BRAINTRUST_PUBLIC_URL) : ""}] "/"]
  variable token [expr {[info exists ::env(BRAINTRUST_RELAY_TOKEN)] ? $::env(BRAINTRUST_RELAY_TOKEN) : ""}]
}

proc btusr::escape {s} {
  return [string map {"\\" "\\\\" "\"" "\\\"" "\n" "\\n" "\r" "\\r" "\t" "\\t"} $s]
}

proc btusr::notice {nick text} {
  foreach line [split $text "\n"] {
    if {$line ne ""} { puthelp "NOTICE $nick :$line" }
  }
}

proc btusr::api {method payload} {
  variable base
  variable token
  if {$base eq "" || [string length $token] < 16} {
    error "Brain Trust user-control endpoint is not configured."
  }
  set url "$base/api/admin?scope=irc-users"
  set cmd [list curl -fsS --max-time 20 -H "Authorization: Bearer $token" -H "Content-Type: application/json"]
  if {$method eq "POST"} { lappend cmd -X POST --data $payload }
  lappend cmd $url
  return [exec {*}$cmd]
}

proc btusr::field {json key} {
  if {[regexp -- "\\\"$key\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"" $json -> value]} {
    return [string map {"\\\"" "\"" "\\\\" "\\" "\\n" "\n"} $value]
  }
  return ""
}

proc btusr::payload {action nick {role ""}} {
  set out "{\"action\":\"[btusr::escape $action]\",\"nick\":\"[btusr::escape $nick]\""
  if {$role ne ""} { append out ",\"role\":\"[btusr::escape $role]\"" }
  append out "}"
  return $out
}

proc btusr::help {nick} {
  btusr::notice $nick "usrctrl: list | show NICK | add NICK ?member|maintainer? | revoke NICK | activate NICK | role NICK member|maintainer | rotate NICK"
}

proc btusr::list_users {nick} {
  set raw [btusr::api GET ""]
  if {![catch {package require json}]} {
    set root [::json::json2dict $raw]
    if {[dict exists $root users]} {
      foreach u [dict get $root users] {
        set n [dict get $u nick]
        set role [string toupper [dict get $u role]]
        set active [expr {[dict get $u active] ? "ACTIVE" : "REVOKED"}]
        set verified [expr {[dict exists $u verified] && [dict get $u verified] ? "VERIFIED" : "PENDING"}]
        btusr::notice $nick "$n · $role · $verified · $active · rev [dict get $u rev]"
      }
      return
    }
  }
  btusr::notice $nick "User list received. Open the owner GUI for the formatted table: $btusr::base/usrctrl.html"
}

proc btusr::run {nick text} {
  set argv [regexp -all -inline {\S+} [string trim $text]]
  set sub [string tolower [lindex $argv 0]]
  if {$sub eq "" || $sub eq "help" || $sub eq "?"} { btusr::help $nick; return }
  if {$sub eq "list"} { btusr::list_users $nick; return }
  if {$sub eq "open" || $sub eq "gui" || $sub eq "link"} { btusr::notice $nick "Owner GUI: $btusr::base/usrctrl.html"; return }
  set target [lindex $argv 1]
  if {$target eq ""} { btusr::notice $nick "Nickname required. Try: usrctrl help"; return }
  if {$sub eq "show"} {
    # The formatted per-user view is intentionally kept in the authenticated GUI.
    btusr::notice $nick "Open $btusr::base/usrctrl.html and select $target."
    return
  }
  if {$sub eq "add" || $sub eq "invite"} {
    set role [string tolower [lindex $argv 2]]
    if {$role eq ""} { set role member }
    if {$role ni {member maintainer}} { error "Role must be member or maintainer." }
    set raw [btusr::api POST [btusr::payload create $target $role]]
    set code [btusr::field $raw code]
    if {$code eq ""} { error "Invite succeeded but no one-time code was returned." }
    btusr::notice $nick "ACCESS CODE for $target: $code"
    btusr::notice $nick "Send that code privately. It is shown once and must never be pasted into the public channel."
    return
  }
  if {$sub in {revoke activate rotate}} {
    set raw [btusr::api POST [btusr::payload $sub $target]]
    if {$sub eq "rotate"} {
      set code [btusr::field $raw code]
      if {$code eq ""} { error "Rotation succeeded but no one-time code was returned." }
      btusr::notice $nick "NEW ACCESS CODE for $target: $code"
    } else {
      btusr::notice $nick "$target: $sub complete."
    }
    return
  }
  if {$sub eq "role"} {
    set role [string tolower [lindex $argv 2]]
    if {$role ni {member maintainer}} { error "Usage: usrctrl role NICK member|maintainer" }
    btusr::api POST [btusr::payload role $target $role]
    btusr::notice $nick "$target: role changed to $role."
    return
  }
  error "Unknown usrctrl subcommand. Try: usrctrl help"
}

proc bt_usrctrl_pub {nick uhost hand chan text} {
  if {![matchattr $hand n]} { return 0 }
  if {[catch {btusr::run $nick $text} err]} { btusr::notice $nick "usrctrl error: $err" }
  return 1
}

proc bt_usrctrl_msg {nick uhost hand text} {
  if {![matchattr $hand n]} { return 0 }
  if {[catch {btusr::run $nick $text} err]} { btusr::notice $nick "usrctrl error: $err" }
  return 1
}

bind pub n !usrctrl bt_usrctrl_pub
bind pub n /usrctrl bt_usrctrl_pub
bind msg n usrctrl bt_usrctrl_msg
bind msg n /usrctrl bt_usrctrl_msg

putlog "Brain Trust usrctrl: Eggdrop owner adapter loaded"
