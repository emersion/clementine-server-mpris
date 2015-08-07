var fs = require('fs');
var ClementineServer = require('clementine-remote').Server;
var mpris = require('mpris');

var server = ClementineServer({
	host: '0.0.0.0',
	port: 5500
});

function getSong(metadata) {
	if (!metadata || !Object.keys(metadata).length) return;

	var art;
	if (metadata['mpris:artUrl'] && metadata['mpris:artUrl'].indexOf('file://') === 0) {
		var artPath = metadata['mpris:artUrl'].replace('file://', '');
		art = fs.readFileSync(artPath);
	}

	var song = {
		id: 0,
		index: 0,
		title: metadata['xesam:title'],
		album: metadata['xesam:album'],
		artist: (metadata['xesam:artist']) ? metadata['xesam:artist'].join() : undefined,
		albumartist: (metadata['xesam:albumArtist']) ? metadata['xesam:albumArtist'].join() : undefined,
		track: metadata['xesam:trackNumber'],
		disc: metadata['xesam:discNumber'],
		//pretty_year: metadata['xesam:contentCreated'],
		genre: metadata['xesam:genre'],
		playcount: metadata['xesam:useCount'],
		art: art,
		length: metadata['mpris:length'] / 1000 / 1000,
		is_local: (metadata['xesam:url'].indexOf('file://') === 0),
		filename: metadata['xesam:url'],
		rating: metadata['xesam:userRating'],
		//url: metadata['xesam:url']
	};

	for (var field in song) {
		if (typeof song[field] == 'undefined') {
			delete song[field];
		}
	}

	return song;
}

mpris.connect(null, function (err) {
	if (err) console.error(err);

	console.log(mpris);

	console.log('Connected to music player');

	var position = 0, positionInterval;
	var startSendingPosition = function () {
		if (positionInterval) {
			return;
		}

		positionInterval = setInterval(function () {
			server.position = position;
			position++;
		}, 1000);
	};
	var stopSendingPosition = function () {
		clearInterval(positionInterval);
		positionInterval = null;
	};
	var resetPosition = function () {
		position = 0;
		server.position = position;
	};

	var handleMetadata = function (metadata) {
		server.song = getSong(metadata);
		resetPosition();
	};

	var handlePlaybackStatus = function (playbackStatus) {
		switch (playbackStatus) {
			case 'Playing':
				server.play();
				startSendingPosition();
				break;
			case 'Paused':
				server.pause();
				stopSendingPosition();
				break;
			case 'Stopped':
				server.stop();
				stopSendingPosition();
				resetPosition();
				break;
		}
	};

	var handlePosition = function (pos) {
		position = Math.round(pos / 1000 / 1000);
	};

	var handleVolume = function (vol) {
		server.volume = Math.round(vol * 100);
	};

	mpris.Player.on('MetadataChanged', handleMetadata);
	mpris.Player.on('PlaybackStatusChanged', handlePlaybackStatus);
	mpris.Player.on('VolumeChanged', handleVolume);

	server.on('playpause', function () {
		mpris.Player.PlayPause();
	});
	server.on('play', function () {
		mpris.Player.Play();
	});
	server.on('pause', function () {
		mpris.Player.Pause();
	});
	server.on('stop', function () {
		mpris.Player.Stop();
	});
	server.on('next', function () {
		mpris.Player.Next();
	});
	server.on('previous', function () {
		mpris.Player.Previous();
	});
	server.on('volume', function (vol) {
		mpris.Player.SetVolume(vol / 100);
	});

	server.on('insert_urls', function (data) {
		mpris.Player.OpenUri(data.urls[0], function () {});
	});

	mpris.Player.GetMetadata(function (err, metadata) {
		handleMetadata(metadata);
	});
	mpris.Player.GetPlaybackStatus(function (err, playbackStatus) {
		handlePlaybackStatus(playbackStatus);
	});
	mpris.Player.GetPosition(function (err, pos) {
		handlePosition(pos);
	});
	
	mpris.TrackList.GetTracks(function (err, trackIds) {
		if (err) return console.error(err);

		mpris.TrackList.GetTracksMetadata(trackIds, function (tracks) {
			tracks.forEach(function (track) {
				server.library.addSong(getSong(track), function (err) {
					if (err) log.error('Could not add song to library:', err);
				});
			});
		});
	});
});

server.listen(function () {
	server.mdns();

	console.log('Server started');
});
