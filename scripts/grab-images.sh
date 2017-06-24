while read url; do
	wget -x "http://schmopera.com$url"
done < ../images.txt
