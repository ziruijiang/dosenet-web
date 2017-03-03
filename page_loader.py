import selenium.webdriver as webdriver
from time import sleep

if __name__ == "__main__":
    urls = ['file:///home/pi/dosenet-web/display-monitors/Front.html', 'https://radwatch.berkeley.edu',
            'https://radwatch.berkeley.edu/rad101#tab2',
            'https://radwatch.berkeley.edu/rad101#tab3',
    		'https://radwatch.berkeley.edu/dosenet/map#dosenet_rad_banner',
    		'https://radwatch.berkeley.edu/dosenet/data#chartdata',
    		'https://radwatch.berkeley.edu/dosenet/data#chartdata',
    		'file:///home/pi/dosenet-web/display-monitors/WeatherStation.html',
            'file:///home/pi/dosenet-web/display-monitors/FindMore.html']
    sleeps = [10,30,10,10,30,30,30,20,15]
b = webdriver.Firefox()
b.set_window_position(0,0)
b.set_window_size(1024, 768)

while True:
    for idx, url in enumerate(urls):
        b.get(url)
        sleep(sleeps[idx])