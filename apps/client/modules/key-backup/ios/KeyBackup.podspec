Pod::Spec.new do |s|
  s.name           = 'KeyBackup'
  s.version        = '0.1.0'
  s.summary        = 'Saves the Proviso household key to iCloud Keychain.'
  s.description    = 'A synchronizable Keychain item holding the household key, so a new iPhone signed in to the same Apple account can recover it.'
  s.author         = 'Proviso'
  s.homepage       = 'https://github.com/Jorget43/proviso'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
