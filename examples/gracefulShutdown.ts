import {Mousse} from '../src/mousse.js';

const app = new Mousse({
	// Options
	// key_file_name: 'misc/key.pem',
	// cert_file_name: 'misc/cert.pem',
	// passphrase: '1234'
})
.get('/shutdown', (c) => {
	c.respond('Shutting down know !');
	c.mousse.stop();
})
.listen(8080);