import selenium.webdriver as webdriver
from time import sleep

if __name__ == "__main__":
    urls = ['file:///home/pi/dosenet-web/display-monitors/Front.html', 'https://radwatch.berkeley.edu',
    		'file:///home/pi/dosenet-web/display-monitors/Rad101.html',
    		'https://radwatch.berkeley.edu/dosenet/map#dosenet_rad_banner',
    		'https://radwatch.berkeley.edu/dosenet/data#chartdata',
    		'file:///home/pi/dosenet-web/display-monitors/Locations2.html',
    		'file:///home/pi/dosenet-web/display-monitors/WeatherStation.html',
            'file:///home/pi/dosenet-web/display-monitors/FindMore.html']
    sleeps = [10,60,10,30,30,30,20,15]
b = webdriver.Firefox()

while True:
    for idx, url in enumerate(urls):
        b.maximize_window()
        b.get(url)
        sleep(sleeps[idx])